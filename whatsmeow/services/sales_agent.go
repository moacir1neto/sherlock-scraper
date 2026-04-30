package services

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/verbeux-ai/whatsmiau/env"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/lib/whatsmiau"
	"github.com/verbeux-ai/whatsmiau/models"
	"go.mau.fi/whatsmeow/types"
	"go.uber.org/zap"
)

// AgentResponse é o structured output esperado do Gemini.
type AgentResponse struct {
	Resposta       string `json:"resposta"`
	AcionarHumano  bool   `json:"acionar_humano"`
	AgendouReuniao bool   `json:"agendou_reuniao"`
}

// SalesAgentService processa mensagens recebidas e decide se responde automaticamente
// ou aciona um humano via SSE.
type SalesAgentService struct {
	db           *sql.DB
	instanceRepo interfaces.InstanceRepository
	whatsapp     *whatsmiau.Whatsmiau
	handoffHub   *HandoffHub
	httpClient   *http.Client
	leadRepo     interfaces.LeadRepository
	messageRepo  interfaces.MessageRepository
	broadcaster  ChatBroadcaster
}

// NewSalesAgentService cria o serviço injetando as dependências necessárias.
func NewSalesAgentService(
	db *sql.DB,
	instanceRepo interfaces.InstanceRepository,
	whatsapp *whatsmiau.Whatsmiau,
	hub *HandoffHub,
	leadRepo interfaces.LeadRepository,
	messageRepo interfaces.MessageRepository,
	broadcaster ChatBroadcaster,
) *SalesAgentService {
	return &SalesAgentService{
		db:           db,
		instanceRepo: instanceRepo,
		whatsapp:     whatsapp,
		handoffHub:   hub,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
		leadRepo:     leadRepo,
		messageRepo:  messageRepo,
		broadcaster:  broadcaster,
	}
}

// ProcessIncoming é chamado pelo chat_worker para cada mensagem recebida (non-group, non-self).
//
// Fluxo:
//  1. Busca company_id via instance_id na tabela instances do banco
//  2. Carrega company_ai_settings — se agent_enabled=false, retorna
//  3. Verifica se chats.ai_paused=true — se sim, retorna
//  4. Carrega histórico (últimas 15 msgs) + dossiê do lead
//  5. Chama Gemini com structured output
//  6. Executa ação: envia resposta OU pausa + emite SSE
func (s *SalesAgentService) ProcessIncoming(ctx context.Context, chatID, instanceID, remoteJID string) error {
	// 1. Obter company_id a partir da instância
	companyID, err := s.getCompanyIDByInstance(ctx, instanceID)
	if err != nil || companyID == "" {
		zap.L().Debug("[SalesAgent] company_id não encontrado", zap.String("instance", instanceID), zap.Error(err))
		return nil
	}

	// 2. Carregar configurações do agente
	settings, err := s.loadAgentSettings(ctx, companyID)
	if err != nil {
		return fmt.Errorf("load agent settings: %w", err)
	}
	if !settings.AgentEnabled {
		return nil
	}
	if settings.AgentSystemPrompt == "" {
		zap.L().Debug("[SalesAgent] system prompt vazio, agente pulado", zap.String("company", companyID))
		return nil
	}

	// 3. Verificar pausa da IA para este chat
	paused, err := s.isChatAIPaused(ctx, chatID)
	if err != nil {
		return fmt.Errorf("check ai_paused: %w", err)
	}
	if paused {
		zap.L().Debug("[SalesAgent] chat com IA pausada", zap.String("chat", chatID))
		return nil
	}

	// 4a. Carregar histórico de mensagens (últimas 15, ordem cronológica)
	history, err := s.loadChatHistory(ctx, chatID, 15)
	if err != nil {
		zap.L().Warn("[SalesAgent] erro ao carregar histórico", zap.String("chat", chatID), zap.Error(err))
		history = nil
	}

	// 4b. Carregar dossiê do lead (opcional — não bloqueia se não encontrado)
	phone := phoneFromJID(remoteJID)
	lead, _ := s.findLeadByPhone(ctx, companyID, phone)

	// 5. Montar prompt e chamar IA (Gemini com fallback Groq)
	prompt := s.buildPrompt(settings, history, lead)
	agentResp, err := s.callAI(ctx, prompt)
	if err != nil {
		return fmt.Errorf("ai call: %w", err)
	}

	// 6. Executar ação
	if agentResp.AgendouReuniao {
		agentResp.AcionarHumano = true
		
		farewell := "Ótimo! Nossa equipe vai entrar em contato em breve para confirmar todos os detalhes da reunião. Foi um prazer falar com você!"
		waResp, err := s.sendReply(ctx, instanceID, remoteJID, farewell)
		if err != nil {
			zap.L().Warn("[SalesAgent] falha ao enviar despedida", zap.String("chat", chatID), zap.Error(err))
		} else {
			s.persistAgentMessage(ctx, chatID, instanceID, waResp, farewell)
		}

		// Garante a chamada do advanceLeadStatus com os status de origem corretos
		s.advanceLeadStatus(ctx, lead, companyID, instanceID, "reuniao_agendada",
			"prospeccao", "contatado", "em_conversa", "negociacao")
			
	} else if agentResp.Resposta != "" {
		waResp, err := s.sendReply(ctx, instanceID, remoteJID, agentResp.Resposta)
		if err != nil {
			zap.L().Warn("[SalesAgent] falha ao enviar resposta", zap.String("chat", chatID), zap.Error(err))
		} else {
			s.persistAgentMessage(ctx, chatID, instanceID, waResp, agentResp.Resposta)
		}
	}

	if !agentResp.AcionarHumano {
		s.advanceLeadStatus(ctx, lead, companyID, instanceID, "contatado", "prospeccao")
		return nil
	}

	// Pausa a IA e emite handoff
	if err := s.pauseChat(ctx, chatID); err != nil {
		zap.L().Warn("[SalesAgent] falha ao pausar chat", zap.String("chat", chatID), zap.Error(err))
	}

	leadName := ""
	if lead != nil {
		leadName = lead.Name
	}
	s.handoffHub.PublishHandoff(HandoffEvent{
		ChatID:     chatID,
		LeadName:   leadName,
		InstanceID: instanceID,
		RemoteJID:  remoteJID,
	})

	zap.L().Info("[SalesAgent] handoff acionado",
		zap.String("chat", chatID),
		zap.String("lead", leadName),
		zap.String("instance", instanceID),
	)
	return nil
}

// ── Helpers internos ──────────────────────────────────────────────────────────

// defaultCompanyID é o company_id padrão usado como fallback quando a instância
// não tem empresa vinculada no Redis (ambiente single-tenant).
const defaultCompanyID = "00000000-0000-0000-0000-000000000001"

func (s *SalesAgentService) getCompanyIDByInstance(ctx context.Context, instanceID string) (string, error) {
	instances, err := s.instanceRepo.List(ctx, instanceID)
	if err != nil {
		return "", err
	}
	if len(instances) > 0 && instances[0].CompanyID != nil && *instances[0].CompanyID != "" {
		return *instances[0].CompanyID, nil
	}
	// Instância sem empresa vinculada no Redis — usa empresa padrão (single-tenant).
	return defaultCompanyID, nil
}

func (s *SalesAgentService) loadAgentSettings(ctx context.Context, companyID string) (*models.AISettings, error) {
	var st models.AISettings
	err := s.db.QueryRowContext(ctx,
		`SELECT company_id, company_name, nicho, oferta, tom_de_voz,
		 COALESCE(agent_enabled, false), COALESCE(agent_system_prompt, '')
		 FROM company_ai_settings WHERE company_id = $1`,
		companyID,
	).Scan(&st.CompanyID, &st.CompanyName, &st.Nicho, &st.Oferta, &st.TomDeVoz,
		&st.AgentEnabled, &st.AgentSystemPrompt)
	if err == sql.ErrNoRows {
		return &models.AISettings{CompanyID: companyID}, nil
	}
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func (s *SalesAgentService) isChatAIPaused(ctx context.Context, chatID string) (bool, error) {
	var paused bool
	err := s.db.QueryRowContext(ctx,
		`SELECT COALESCE(ai_paused, false) FROM chats WHERE id = $1`,
		chatID,
	).Scan(&paused)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return paused, err
}

func (s *SalesAgentService) pauseChat(ctx context.Context, chatID string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE chats SET ai_paused = true WHERE id = $1`,
		chatID,
	)
	return err
}

func (s *SalesAgentService) loadChatHistory(ctx context.Context, chatID string, limit int) ([]models.Message, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, chat_id, wa_message_id, from_me, message_type, content, media_url, status, created_at
		 FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT $2`,
		chatID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []models.Message
	for rows.Next() {
		var m models.Message
		if err := rows.Scan(&m.ID, &m.ChatID, &m.WAMessageID, &m.FromMe, &m.MessageType,
			&m.Content, &m.MediaURL, &m.Status, &m.CreatedAt); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	// Reverter para ordem cronológica (mais antigas primeiro)
	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
		msgs[i], msgs[j] = msgs[j], msgs[i]
	}
	return msgs, rows.Err()
}

func (s *SalesAgentService) findLeadByPhone(ctx context.Context, companyID, phone string) (*models.Lead, error) {
	if phone == "" {
		return nil, nil
	}
	// Tenta correspondência exata ou sufixo (DDI opcional)
	var lead models.Lead
	err := s.db.QueryRowContext(ctx,
		`SELECT id, name, COALESCE(ai_analysis, ''), COALESCE(kanban_status, 'prospeccao') FROM leads
		 WHERE company_id = $1 AND phone LIKE '%' || $2
		 LIMIT 1`,
		companyID, phone,
	).Scan(&lead.ID, &lead.Name, &lead.AIAnalysis, &lead.KanbanStatus)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	lead.CompanyID = companyID
	return &lead, nil
}

func (s *SalesAgentService) buildPrompt(settings *models.AISettings, history []models.Message, lead *models.Lead) string {
	var sb strings.Builder

	sb.WriteString("Você é Zé, vendedor da Whastmiau. Regras absolutas:\n")
	sb.WriteString("Máximo 7 palavras por mensagem.\n")
	sb.WriteString("Nunca diga \"oi\", \"tudo bem\" ou \"sou assistente virtual\".\n")
	sb.WriteString("Vá direto ao ponto — faça uma pergunta curta.\n")
	sb.WriteString("Se o lead demonstrar interesse: \"Agendamos uma reunião rápida amanhã?\"\n")
	sb.WriteString("Se o lead responder \"sim\", \"quero\", \"vamos\" ou perguntar \"que horas?\"/\"quando?\": SUGIRA um horário específico. Ex: \"Amanhã às 10h ou 15h. Qual prefere?\"\n")
	sb.WriteString("Se o lead aceitar um horário específico (ex: \"10h\", \"pode ser 15h\"): CONFIRME a reunião e retorne SOMENTE o JSON com agendou_reuniao:true e acionar_humano:true. NÃO envie mensagem de texto.\n")
	sb.WriteString("Se perguntar preço: \"Na reunião explico tudo. Amanhã às 10h?\"\n")
	sb.WriteString("Se disser \"não\" ou \"depois\": \"Sem problema. Deixo meu contato?\"\n\n")

	sb.WriteString("=== CONTEXTO DA EMPRESA (VENDEDOR) ===\n")
	sb.WriteString(fmt.Sprintf("Empresa: %s\n", settings.CompanyName))
	if settings.Nicho != "" {
		sb.WriteString(fmt.Sprintf("Nicho: %s\n", settings.Nicho))
	}
	if settings.Oferta != "" {
		sb.WriteString(fmt.Sprintf("Oferta/Solução: %s\n", settings.Oferta))
	}
	if settings.TomDeVoz != "" {
		sb.WriteString(fmt.Sprintf("Tom de voz: %s\n", settings.TomDeVoz))
	}
	sb.WriteString("\n")

	if lead != nil && lead.AIAnalysis != "" {
		sb.WriteString("=== DOSSIÊ DO LEAD ===\n")
		sb.WriteString(lead.AIAnalysis)
		sb.WriteString("\n\n")
	}

	if len(history) > 0 {
		sb.WriteString("=== HISTÓRICO DA CONVERSA (mais antigas primeiro) ===\n")
		for _, msg := range history {
			role := "lead"
			if msg.FromMe {
				role = "agente"
			}
			if msg.Content != "" {
				sb.WriteString(fmt.Sprintf("[%s]: %s\n", role, msg.Content))
			}
		}
		sb.WriteString("\n")
	}

	sb.WriteString("=== INSTRUÇÃO FINAL ===\n")
	sb.WriteString("Gere o JSON da sua resposta seguindo ESTRITAMENTE as regras acima.\n")
	sb.WriteString("Responda APENAS com JSON válido, sem texto adicional ou formatação markdown (sem ```json):\n")
	sb.WriteString(`{"resposta": "<sua resposta>", "acionar_humano": <true|false>, "agendou_reuniao": <true|false>}`)

	return sb.String()
}

// ── Gemini REST API ───────────────────────────────────────────────────────────

type geminiAgentRequest struct {
	Contents         []geminiContent        `json:"contents"`
	GenerationConfig geminiAgentGenConfig   `json:"generationConfig"`
}

type geminiAgentGenConfig struct {
	ResponseMIMEType string              `json:"responseMimeType"`
	ResponseSchema   geminiResponseSchema `json:"responseSchema"`
	Temperature      float64             `json:"temperature"`
}

type geminiResponseSchema struct {
	Type       string                        `json:"type"`
	Properties map[string]geminiSchemaProp   `json:"properties"`
	Required   []string                      `json:"required"`
}

type geminiSchemaProp struct {
	Type string `json:"type"`
}

type geminiAgentResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

const geminiAgentModel = "gemini-2.5-flash"

func (s *SalesAgentService) callGemini(ctx context.Context, prompt string) (*AgentResponse, error) {
	apiKey := env.Env.GeminiAPIKey
	if apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY não configurada")
	}

	reqBody := geminiAgentRequest{
		Contents: []geminiContent{
			{Role: "user", Parts: []geminiPart{{Text: prompt}}},
		},
		GenerationConfig: geminiAgentGenConfig{
			ResponseMIMEType: "application/json",
			Temperature:      0.3,
			ResponseSchema: geminiResponseSchema{
				Type: "OBJECT",
				Properties: map[string]geminiSchemaProp{
					"resposta":        {Type: "STRING"},
					"acionar_humano":  {Type: "BOOLEAN"},
					"agendou_reuniao": {Type: "BOOLEAN"},
				},
				Required: []string{"resposta", "acionar_humano", "agendou_reuniao"},
			},
		},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		geminiAgentModel, apiKey,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http call: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gemini status %d: %s", resp.StatusCode, string(raw))
	}

	var geminiResp geminiAgentResponse
	if err := json.Unmarshal(raw, &geminiResp); err != nil {
		return nil, fmt.Errorf("unmarshal gemini response: %w", err)
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("gemini retornou resposta vazia")
	}

	jsonText := geminiResp.Candidates[0].Content.Parts[0].Text
	var agentResp AgentResponse
	if err := json.Unmarshal([]byte(jsonText), &agentResp); err != nil {
		return nil, fmt.Errorf("unmarshal agent response JSON %q: %w", jsonText, err)
	}

	return &agentResp, nil
}

// callAI tenta Gemini primeiro; se falhar ou não estiver configurado, tenta Groq.
func (s *SalesAgentService) callAI(ctx context.Context, prompt string) (*AgentResponse, error) {
	if env.Env.GeminiAPIKey != "" {
		resp, err := s.callGemini(ctx, prompt)
		if err == nil {
			return resp, nil
		}
		zap.L().Warn("[SalesAgent] Gemini falhou, tentando Groq", zap.Error(err))
	}
	if env.Env.GroqAPIKey != "" {
		return CallGroqForAgent(ctx, prompt)
	}
	return nil, fmt.Errorf("nenhum provider de IA disponível (GEMINI_API_KEY e GROQ_API_KEY ausentes)")
}

// ── Envio de mensagem ─────────────────────────────────────────────────────────

// sanitizeAgentReply remove artefatos indesejados que o LLM pode inserir na resposta:
// exclamações iniciais, blocos de código markdown, aspas externas e espaços extras.
func sanitizeAgentReply(text string) string {
	// Remove blocos de código markdown (```...```)
	text = strings.ReplaceAll(text, "```", "")

	// Remove pipes e aspas que envolvam a resposta inteira
	text = strings.Trim(text, "|\"'`")

	// Remove '!' e espaços do início (artefato comum de escape de prompt)
	text = strings.TrimLeft(text, "! ")

	// Normaliza espaços extras nas bordas
	text = strings.TrimSpace(text)

	return text
}

func (s *SalesAgentService) sendReply(ctx context.Context, instanceID, remoteJID, text string) (*whatsmiau.SendTextResponse, error) {
	jid, err := types.ParseJID(remoteJID)
	if err != nil {
		return nil, fmt.Errorf("parse jid %q: %w", remoteJID, err)
	}

	return s.whatsapp.SendText(ctx, &whatsmiau.SendText{
		Text:       sanitizeAgentReply(text),
		InstanceID: instanceID,
		RemoteJID:  &jid,
	})
}

// persistAgentMessage salva a mensagem enviada pelo agente no banco e faz broadcast
// para o frontend exibir em tempo real no chat do WhatsMiau.
func (s *SalesAgentService) persistAgentMessage(ctx context.Context, chatID, instanceID string, waResp *whatsmiau.SendTextResponse, text string) {
	if s.messageRepo == nil || waResp == nil {
		return
	}
	msg := &models.Message{
		ChatID:      chatID,
		WAMessageID: waResp.ID,
		FromMe:      true,
		MessageType: "text",
		Content:     sanitizeAgentReply(text),
		Status:      "sent",
		CreatedAt:   waResp.CreatedAt,
	}
	if err := s.messageRepo.Create(ctx, msg); err != nil {
		zap.L().Warn("[SalesAgent] falha ao persistir mensagem do agente", zap.String("chat", chatID), zap.Error(err))
		return
	}
	if s.broadcaster != nil {
		s.broadcaster.BroadcastEvent(instanceID, "new_message", map[string]interface{}{
			"chat_id": chatID, "message": msg, "instance_id": instanceID,
		})
	}
}

// advanceLeadStatus atualiza o kanban_status do lead se o status atual estiver
// na lista de origens permitidas. Emite evento SSE para o frontend.
func (s *SalesAgentService) advanceLeadStatus(ctx context.Context, lead *models.Lead, companyID, instanceID, targetStatus string, allowedFrom ...string) {
	if lead == nil || s.leadRepo == nil {
		return
	}

	allowed := false
	for _, from := range allowedFrom {
		if lead.KanbanStatus == from {
			allowed = true
			break
		}
	}
	if !allowed {
		return
	}

	if err := s.leadRepo.UpdateStatus(ctx, lead.ID, companyID, targetStatus); err != nil {
		zap.L().Warn("[SalesAgent] falha ao atualizar kanban", zap.String("lead", lead.ID), zap.Error(err))
		return
	}

	lead.KanbanStatus = targetStatus
	zap.L().Info("[SalesAgent] kanban: lead movido", zap.String("lead", lead.Name), zap.String("status", targetStatus))

	if s.broadcaster != nil {
		s.broadcaster.BroadcastEvent(instanceID, "lead_kanban_updated", map[string]interface{}{
			"type":       "lead_kanban_updated",
			"lead_id":    lead.ID,
			"new_status": targetStatus,
			"empresa":    lead.Name,
		})
	}
}
