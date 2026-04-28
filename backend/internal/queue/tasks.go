package queue

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/database"
	"github.com/digitalcombo/sherlock-scraper/backend/pkg/phoneutil"
	"github.com/hibiken/asynq"
	"golang.org/x/sync/errgroup"
)

type SherlockCNPJResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
	Message string `json:"message"`
	Dados   struct {
		CNPJ              string `json:"cnpj"`
		SituacaoCadastral string `json:"situacao_cadastral"`
		Email             string `json:"email"`
		Telefone          string `json:"telefone"`
	} `json:"dados"`
}

const (
	TaskTypeEnrichLead    = "enrich:lead"
	TaskTypeBulkMessage   = "lead:bulk-message"
	TaskTypeEnrichCNPJ    = "enrich:cnpj"
)

type EnrichLeadPayload struct {
	CompanyName string `json:"company_name"`
	LeadID      string `json:"lead_id"`
}

func GetAsynqClient() *asynq.Client {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	return asynq.NewClient(asynq.RedisClientOpt{Addr: redisAddr})
}

type EnrichCNPJPayload struct {
	LeadID      string `json:"lead_id"`
	CompanyName string `json:"company_name"`
}
func NewEnrichCNPJTask(leadID, companyName string) (*asynq.Task, error) {
	payload, err := json.Marshal(EnrichCNPJPayload{LeadID: leadID, CompanyName: companyName})
	if err != nil {
		return nil, err
	}


	delay := time.Duration(1+(time.Now().UnixNano()%5)) * time.Second

	return asynq.NewTask(TaskTypeEnrichCNPJ, payload,
		asynq.Queue("cnpj"),
		asynq.MaxRetry(3),
		asynq.ProcessIn(delay),
	), nil
}

// NewEnrichLeadTask creates a new task to enrich a lead.
func NewEnrichLeadTask(leadID, companyName string) (*asynq.Task, error) {
	payload, err := json.Marshal(EnrichLeadPayload{
		LeadID:      leadID,
		CompanyName: companyName,
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TaskTypeEnrichLead, payload), nil
}

// ═══════════════════════════════════════════════════════════════
// BULK MESSAGE — Task + Handler
// ═══════════════════════════════════════════════════════════════

// BulkMessagePayload carries the data for a single message dispatch injected by the CRM.
type BulkMessagePayload struct {
	LeadID      string `json:"lead_id"`
	InstanceID  string `json:"instance_id"`
	CampaignID  string `json:"campaign_id"`
	Phone       string `json:"phone"`
	CompanyName string `json:"company_name"`
	AIAnalysis  string `json:"ai_analysis"`
}

// CampaignEvent é o payload JSON publicado no canal Redis campaigns:logs:<id>.
// O front-end consome via SSE para exibir progresso em tempo real.
type CampaignEvent struct {
	Type    string `json:"type"`    // "start", "success", "error", "skip"
	LeadID  string `json:"lead_id"`
	Empresa string `json:"empresa"`
	Message string `json:"message"`
}

// NewBulkMessageTask creates a new Asynq task for sending a prospection message.
func NewBulkMessageTask(payload BulkMessagePayload) (*asynq.Task, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TaskTypeBulkMessage, data, asynq.MaxRetry(3)), nil
}

// publishEvent serializa e publica um CampaignEvent no canal Redis da campanha.
func publishEvent(campaignID, eventType, leadID, empresa, message string) {
	evt := CampaignEvent{
		Type:    eventType,
		LeadID:  leadID,
		Empresa: empresa,
		Message: message,
	}
	data, err := json.Marshal(evt)
	if err != nil {
		log.Printf("[BulkMessage] ⚠️ Falha ao serializar evento: %v", err)
		return
	}
	PublishCampaignEvent(campaignID, string(data))
}

// HandleBulkMessageTask processes a single prospection message as a pass-through broker.
// Retryable errors (network) are returned without SkipRetry.
// Permanent errors (no phone) are wrapped with SkipRetry.
func HandleBulkMessageTask(ctx context.Context, t *asynq.Task) error {
	var payload BulkMessagePayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("json.Unmarshal failed: %v: %w", err, asynq.SkipRetry)
	}

	empresa := payload.CompanyName
	if empresa == "" {
		empresa = "Desconhecido"
	}

	log.Printf("📨 [BulkMessage] Iniciando disparo cego para Lead %s (%s) (instance: %s)",
		payload.LeadID, empresa, payload.InstanceID)

	// 1. Evento START — notifica front-end que o processamento iniciou
	publishEvent(payload.CampaignID, "start", payload.LeadID, empresa,
		fmt.Sprintf("Iniciando envio para %s...", empresa))

	// 2. Validate phone number
	if payload.Phone == "" {
		log.Printf("⏭️  [BulkMessage] Lead '%s' sem telefone. Pulando.", empresa)
		publishEvent(payload.CampaignID, "skip", payload.LeadID, empresa,
			fmt.Sprintf("⚠️ %s sem telefone cadastrado", empresa))
		return fmt.Errorf("lead has no phone: %w", asynq.SkipRetry)
	}

	// 3. Normalize phone
	phone, normErr := phoneutil.NormalizeForWhatsApp(payload.Phone)
	if normErr != nil {
		log.Printf("⏭️  [BulkMessage] Lead '%s' com telefone inválido (%q). Pulando.",
			empresa, payload.Phone)
		publishEvent(payload.CampaignID, "skip", payload.LeadID, empresa,
			fmt.Sprintf("⚠️ Telefone inválido para %s", empresa))
		return fmt.Errorf("invalid phone number for lead %s: %w", empresa, asynq.SkipRetry)
	}

	// 3.1 FAIL-FAST VALIDATION: Verificar se o número existe na Meta antes de tentar o envio
	exists, validatedJid, err := checkWhatsAppExistence(payload.InstanceID, phone)
	if err != nil {
		// Erro de rede ou timeout: Retornamos erro normal para o Asynq fazer retry agendado
		return fmt.Errorf("falha ao validar existência no whatsapp: %v", err)
	}

	if !exists {
		log.Printf("⏭️  [BulkMessage] Lead '%s' (%s) não possui conta no WhatsApp. Cancelando.", empresa, phone)
		publishEvent(payload.CampaignID, "skip", payload.LeadID, empresa,
			fmt.Sprintf("❌ Sem WhatsApp: Disparo cancelado para %s", empresa))

		// Atualiza o Lead no banco de dados para StatusPerdido
		dbErr := database.DB.Model(&domain.Lead{}).Where("id = ?", payload.LeadID).Updates(map[string]interface{}{
			"kanban_status":    domain.StatusPerdido,
			"notas_prospeccao": "Número sem WhatsApp (Fail-Fast Validated)",
		}).Error
		if dbErr != nil {
			log.Printf("⚠️  [BulkMessage] Erro ao atualizar status do lead %s: %v", payload.LeadID, dbErr)
		}

		// Cancela a tarefa permanentemente no Asynq
		return fmt.Errorf("%w: número inexistente na Meta", asynq.SkipRetry)
	}

	// Se existe, usamos o JID oficial validado (corrige problemas de 9º dígito)
	phone = validatedJid
	log.Printf("🎯 [BulkMessage] Número validado na Meta para '%s': %s", empresa, phone)

	// 4. Converter payload string back temporariamente para domain.Lead para reaproveitar construção de mensagem
	leadMock := domain.Lead{ Empresa: empresa, AIAnalysis: []byte(payload.AIAnalysis) }
	
	// 5. Extract icebreaker from AI analysis (if available)
	messageText := buildProspectionMessage(leadMock)
	log.Printf("💬 [BulkMessage] Mensagem para '%s': %.80s...", empresa, messageText)

	// 6. Send via WhatsMiau API
	if err := sendViaWhatsMiau(payload.InstanceID, phone, messageText); err != nil {
		log.Printf("⚠️  [BulkMessage] Falha ao enviar para '%s': %v (retry possível)", empresa, err)
		publishEvent(payload.CampaignID, "error", payload.LeadID, empresa,
			fmt.Sprintf("❌ Falha ao enviar para %s", empresa))
		return err // retryable — Asynq will retry
	}

	// NOTA ARQUITETURAL: Não atualizamos o Kanban aqui (database.DB.Model). 
	// O WhatsMiau é dono do CRM e atualizará quando o Webhook/Disparo confirmar o envio.

	// 8. Evento SUCCESS — notifica front-end que o envio foi concluído
	publishEvent(payload.CampaignID, "success", payload.LeadID, empresa,
		fmt.Sprintf("✅ Enviado com sucesso para %s", empresa))

	log.Printf("✅ [BulkMessage] Mensagem enviada com sucesso para '%s' (%s) → disparo concluído",
		empresa, phone)

	return nil
}

// buildProspectionMessage extracts the icebreaker from AIAnalysis or falls back to a generic greeting.
func buildProspectionMessage(lead domain.Lead) string {
	if len(lead.AIAnalysis) > 0 {
		var analysis map[string]interface{}
		if err := json.Unmarshal(lead.AIAnalysis, &analysis); err == nil {
			if icebreaker, ok := analysis["icebreaker_whatsapp"].(string); ok && icebreaker != "" {
				return icebreaker
			}
		}
	}

	return fmt.Sprintf(
		"Olá! Tudo bem? Vi que a %s atua no segmento de %s e gostaria de apresentar uma solução que pode ajudar vocês. Podemos conversar?",
		lead.Empresa, lead.Nicho,
	)
}

// sendViaWhatsMiau performs an HTTP POST to the WhatsMiau /v1/message/sendText/:instance endpoint.
func sendViaWhatsMiau(instanceID, phone, text string) error {
	apiURL := os.Getenv("WHATSMIau_API_URL")
	if apiURL == "" {
		apiURL = "http://whatsmiau-api:8080"
	}

	// WhatsMiau Evolution route is /v1/message/sendText/:instance
	endpoint := fmt.Sprintf("%s/v1/message/sendText/%s", apiURL, instanceID)

	body := map[string]interface{}{
		"number":     phone,
		"text":       text,
		"delay":      1200, // Simula tempo de digitação
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal request body: %w", err)
	}

	req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonBody))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Adiciona apikey se configurada
	if apiToken := os.Getenv("WHATSMIau_API_TOKEN"); apiToken != "" {
		req.Header.Set("apikey", apiToken)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("whatsmiau connection error: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))

	if resp.StatusCode >= 400 {
		return fmt.Errorf("whatsmiau returned %d: %s", resp.StatusCode, string(respBody))
	}

	log.Printf("📡 [BulkMessage] WhatsMiau response %d: %s", resp.StatusCode, string(respBody))
	return nil
}

// WhatsAppExistsItem mapeia o item individual da checagem do WhatsMiau
type WhatsAppExistsItem struct {
	Exists bool   `json:"exists"`
	Jid    string `json:"jid"`
}

// CheckWhatsAppResponse mapeia a lista de retorno do WhatsMiau
type CheckWhatsAppResponse []WhatsAppExistsItem

// checkWhatsAppExistence consulta o WhatsMiau para verificar se o número está na rede Meta.
// Reutiliza o endpoint /v1/chat/whatsappNumbers/:instance (padrão Evolution/WhatsMiau).
func checkWhatsAppExistence(instanceID, phone string) (bool, string, error) {
	apiURL := os.Getenv("WHATSMIau_API_URL")
	if apiURL == "" {
		apiURL = "http://whatsmiau-api:8080"
	}

	endpoint := fmt.Sprintf("%s/v1/chat/whatsappNumbers/%s", apiURL, instanceID)

	body := map[string]interface{}{
		"numbers": []string{phone},
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return false, "", err
	}

	req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonBody))
	if err != nil {
		return false, "", err
	}

	req.Header.Set("Content-Type", "application/json")
	if apiToken := os.Getenv("WHATSMIau_API_TOKEN"); apiToken != "" {
		req.Header.Set("apikey", apiToken)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return false, "", fmt.Errorf("whatsmiau returned %d: %s", resp.StatusCode, string(respBody))
	}

	var results CheckWhatsAppResponse
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return false, "", err
	}

	if len(results) > 0 {
		return results[0].Exists, results[0].Jid, nil
	}

	return false, "", nil
}

type EnrichmentResult struct {
	WebsiteData *WebsiteData
	GoogleData  *GoogleData
	InstaData   *SocialData
	FBData      *SocialData
}

// performLeadEnrichment executa o pipeline completo de enrichment para um lead e persiste os resultados.
// Pode ser chamada diretamente (ex: pelo dossier pipeline) sem passar por um Asynq task handler.
func performLeadEnrichment(ctx context.Context, lead *domain.Lead) error {
	companyName := lead.Empresa

	enrichCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	var result EnrichmentResult
	var mu sync.Mutex

	g1, _ := errgroup.WithContext(enrichCtx)

	hasWebsite := lead.Site != "" && strings.HasPrefix(strings.ToLower(lead.Site), "http")
	if hasWebsite {
		g1.Go(func() error {
			data, err := FetchAndParseWebsite(lead.Site, companyName)
			if err != nil {
				log.Printf("⚠️  Website inacessível para '%s': %v", companyName, err)
				return nil
			}
			mu.Lock()
			result.WebsiteData = data
			mu.Unlock()
			return nil
		})
	}

	g1.Go(func() error {
		log.Printf("🔍 Buscando Google Reviews para: %s", lead.Empresa)
		data, err := ScrapeGoogleReviews(lead.Empresa)
		if err != nil {
			log.Printf("⚠️  Google Reviews: %v", err)
			return nil
		}
		mu.Lock()
		result.GoogleData = data
		mu.Unlock()
		return nil
	})

	g1.Wait()

	if result.WebsiteData != nil {
		if result.WebsiteData.Instagram != "" && lead.Instagram == "" {
			lead.Instagram = result.WebsiteData.Instagram
			log.Printf("📷 Instagram encontrado: %s", lead.Instagram)
		}
		if result.WebsiteData.Facebook != "" && lead.Facebook == "" {
			lead.Facebook = result.WebsiteData.Facebook
			log.Printf("👥 Facebook encontrado: %s", lead.Facebook)
		}
		lead.TemPixel = result.WebsiteData.TemPixel
		lead.TemGTM = result.WebsiteData.TemGTM
		if lead.TemPixel {
			log.Printf("🎯 Facebook Pixel detectado!")
		}
		if lead.TemGTM {
			log.Printf("📈 Google Tag Manager detectado!")
		}
	}

	if !hasWebsite && lead.Instagram == "" && lead.Facebook == "" {
		log.Printf("⏭️  Lead '%s' sem website válido. Pulando Deep Enrichment.", companyName)
		if result.GoogleData != nil {
			fallbackDeepData := &DeepDataStructure{Google: result.GoogleData}

			// Gerar Insights via LLM mesmo sem website, usando dados do Google
			insights, insErr := ExtractBusinessInsightsFallback(companyName, lead.Nicho, result.GoogleData)
			if insErr != nil {
				log.Printf("⚠️  Fallback Insights falhou (short-circuit) lead_id=%d: %v", lead.ID, insErr)
			} else if insights != nil {
				fallbackDeepData.Insights = insights
				log.Printf("✨ Insights (fallback short-circuit) extraídos: tipo=%q marketing=%q serviços=%d lead_id=%d",
					insights.BusinessType, insights.MarketingLevel, len(insights.Services), lead.ID)
			}

			deepDataJSON, err := json.Marshal(fallbackDeepData)
			if err == nil && len(deepDataJSON) > 0 && json.Valid(deepDataJSON) {
				lead.DeepData = deepDataJSON
				log.Printf("💾 deep_data validado e salvo (fallback Google) lead_id=%d", lead.ID)
			} else {
				log.Printf("⚠️  deep_data inválido descartado (fallback Google) lead_id=%d err=%v", lead.ID, err)
				lead.DeepData = nil
			}
		}
		lead.Status = domain.StatusEnriquecido
		if err := database.DB.Save(lead).Error; err != nil {
			log.Printf("⚠️  Erro ao marcar lead como ENRIQUECIDO: %v", err)
			return err
		}
		log.Printf("✅ Lead '%s' marcado como ENRIQUECIDO (sem website)", companyName)
		return nil
	}

	// ═══════════════════════════════════════════════════════════════
	// PHASE 2: Instagram + Facebook — em paralelo
	// ═══════════════════════════════════════════════════════════════
	log.Printf("🕵️  Iniciando Deep Enrichment para: %s", companyName)

	g2, _ := errgroup.WithContext(enrichCtx)

	if lead.Instagram != "" && strings.HasPrefix(lead.Instagram, "http") {
		g2.Go(func() error {
			log.Printf("🔍 Extraindo inteligência do Instagram...")
			data := ScrapeInstagramProfile(lead.Instagram)
			mu.Lock()
			result.InstaData = data
			mu.Unlock()
			return nil
		})
	}

	if lead.Facebook != "" && strings.HasPrefix(lead.Facebook, "http") {
		g2.Go(func() error {
			log.Printf("🔍 Extraindo inteligência do Facebook...")
			data := ScrapeFacebookPage(lead.Facebook)
			mu.Lock()
			result.FBData = data
			mu.Unlock()
			return nil
		})
	}

	g2.Wait()

	// ═══════════════════════════════════════════════════════════════
	// Consolidar resultados em DeepData
	// ═══════════════════════════════════════════════════════════════
	deepData := &DeepDataStructure{}

	if result.InstaData != nil {
		if result.InstaData.Success {
			deepData.Instagram = &SocialPlatformData{
				Bio:          result.InstaData.Bio,
				LastPostDate: result.InstaData.LastPostDate,
				Posts:        result.InstaData.RecentPosts,
			}
			log.Printf("✨ Deep intelligence extraída do Instagram!")
		} else {
			log.Printf("⚠️  Instagram: %s", result.InstaData.ErrorMessage)
		}
	}

	if result.FBData != nil {
		if result.FBData.Success {
			deepData.Facebook = &SocialPlatformData{
				Bio:          result.FBData.Bio,
				LastPostDate: result.FBData.LastPostDate,
				Posts:        result.FBData.RecentPosts,
			}
			log.Printf("✨ Deep intelligence extraída do Facebook!")
		} else {
			log.Printf("⚠️  Facebook: %s", result.FBData.ErrorMessage)
		}
	}

	if result.GoogleData != nil {
		deepData.Google = result.GoogleData
		log.Printf("✨ Google Reviews consolidado (Nota: %s, Avaliações: %s, Comentários: %d)",
			result.GoogleData.NotaGeral, result.GoogleData.TotalAvaliacoes,
			len(result.GoogleData.ComentariosRecentes))
	}

	// ═══════════════════════════════════════════════════════════════
	// PHASE 3: Business Insights via LLM
	// ═══════════════════════════════════════════════════════════════
	if result.WebsiteData != nil && result.WebsiteData.RawText != "" {
		log.Printf("🤖 Extraindo insights de negócio via LLM para: %s", companyName)
		insights, err := ExtractBusinessInsights(result.WebsiteData.RawText)
		if err != nil {
			log.Printf("⚠️  Erro ao extrair insights via LLM: %v", err)
		} else if insights != nil {
			deepData.Insights = insights
			log.Printf("✨ Insights extraídos: tipo=%q marketing=%q serviços=%d",
				insights.BusinessType, insights.MarketingLevel, len(insights.Services))
		} else {
			log.Printf("⚠️  LLM retornou insights nil para '%s' (RawText=%d chars)", companyName, len(result.WebsiteData.RawText))
		}
	} else {
		log.Printf("🔄 Generating insights via fallback (no website) para: %s", companyName)
		insights, err := ExtractBusinessInsightsFallback(companyName, lead.Nicho, result.GoogleData)
		if err != nil {
			log.Printf("⚠️  Erro ao extrair insights via fallback: %v", err)
		} else if insights != nil {
			deepData.Insights = insights
			log.Printf("✨ Insights (fallback) extraídos: tipo=%q marketing=%q serviços=%d",
				insights.BusinessType, insights.MarketingLevel, len(insights.Services))
		} else {
			log.Printf("⚠️  Fallback LLM retornou insights nil para '%s'", companyName)
		}
	}

	if deepData.Instagram != nil || deepData.Facebook != nil || deepData.Google != nil || deepData.Insights != nil {
		deepDataJSON, err := json.Marshal(deepData)
		if err == nil && len(deepDataJSON) > 0 && json.Valid(deepDataJSON) {
			lead.DeepData = deepDataJSON
			log.Printf("💾 deep_data validado e salvo lead_id=%d instagram=%v facebook=%v google=%v insights=%v",
				lead.ID,
				deepData.Instagram != nil, deepData.Facebook != nil,
				deepData.Google != nil, deepData.Insights != nil)
		} else {
			log.Printf("⚠️  deep_data inválido descartado lead_id=%d err=%v", lead.ID, err)
			lead.DeepData = nil
		}
	} else {
		log.Printf("⚠️  deep_data vazio, nenhum dado coletado lead_id=%d company=%q", lead.ID, companyName)
	}

	lead.Score = ScoreLead(*lead)
	log.Printf("🎯 Lead Score calculado para %s: %d/100", companyName, lead.Score)

	lead.Status = domain.StatusEnriquecido
	if err := database.DB.Save(lead).Error; err != nil {
		log.Printf("⚠️  Erro ao salvar dados enriquecidos: %v", err)
		return err
	}

	// Validar persistência: confirmar que deep_data foi salvo no banco
	var savedLead domain.Lead
	if err := database.DB.Select("id, deep_data").First(&savedLead, "id = ?", lead.ID).Error; err != nil {
		log.Printf("⚠️  [Validate] Falha ao confirmar persistência de DeepData para '%s': %v", companyName, err)
	} else if len(savedLead.DeepData) == 0 {
		log.Printf("🚨 [Validate] FALHA: deep_data está VAZIO no banco após Save para '%s'", companyName)
	} else {
		var check DeepDataStructure
		if err := json.Unmarshal(savedLead.DeepData, &check); err != nil {
			log.Printf("🚨 [Validate] deep_data salvo mas inválido para '%s': %v", companyName, err)
		} else {
			log.Printf("✅ [Validate] deep_data confirmado no banco para '%s': insights=%v google=%v instagram=%v facebook=%v",
				companyName, check.Insights != nil, check.Google != nil, check.Instagram != nil, check.Facebook != nil)
			if check.Insights == nil {
				log.Printf("⚠️  [Validate] Insights AUSENTES no deep_data persistido para '%s' — dossiê usará dados genéricos", companyName)
			}
		}
	}

	// Invalidar cache de dossiê para forçar regeneração com dados atualizados
	if deepData.Insights != nil {
		if err := database.DB.Where("lead_id = ?", lead.ID).Delete(&domain.LeadDossier{}).Error; err != nil {
			log.Printf("⚠️  Falha ao invalidar cache de dossiê lead_id=%s: %v", lead.ID, err)
		} else {
			log.Printf("🗑️  Cache de dossiê invalidado lead_id=%s (novo enrichment com Insights)", lead.ID)
		}
	}

	log.Printf("✨ Enriquecimento concluído para: %s (Pixel: %v, GTM: %v, Google: %v, Score: %d)",
		companyName, lead.TemPixel, lead.TemGTM, deepData.Google != nil, lead.Score)

	return nil
}

// checkJobCompletion is called after each lead enrichment finishes.
// It counts leads still pending enrichment for the job; when the count
// reaches zero the job is atomically flipped to ScrapeCompleted.
func checkJobCompletion(ctx context.Context, jobID string) {
	var pending int64
	err := database.DB.WithContext(ctx).Model(&domain.Lead{}).
		Where("scraping_job_id = ? AND status NOT IN ?", jobID,
			[]string{string(domain.StatusEnriquecido), string(domain.StatusEnrichmentFailed)}).
		Count(&pending).Error
	if err != nil {
		log.Printf("⚠️  [JobCompletion] Erro ao contar leads pendentes para job %s: %v", jobID, err)
		return
	}

	log.Printf("📊 [JobCompletion] Job %s — leads ainda pendentes: %d", jobID, pending)

	if pending == 0 {
		res := database.DB.WithContext(ctx).Model(&domain.ScrapingJob{}).
			Where("id = ? AND status = ?", jobID, domain.ScrapeEnriching).
			Update("status", domain.ScrapeCompleted)
		if res.Error != nil {
			log.Printf("⚠️  [JobCompletion] Erro ao marcar job %s como COMPLETED: %v", jobID, res.Error)
			return
		}
		if res.RowsAffected > 0 {
			log.Printf("✅ [JobCompletion] Job %s → COMPLETED (todos os leads enriquecidos)", jobID)
		}
	}
}

func HandleEnrichLeadTask(ctx context.Context, t *asynq.Task) error {
	var payload EnrichLeadPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("json.Unmarshal failed: %v: %w", err, asynq.SkipRetry)
	}

	log.Printf("🔄 Processing task LEAD_ENRICH:%s (%s)", payload.LeadID, payload.CompanyName)

	var lead domain.Lead
	if err := database.DB.First(&lead, "id = ?", payload.LeadID).Error; err != nil {
		log.Printf("⚠️  Erro ao buscar lead %s: %v", payload.LeadID, err)
		return fmt.Errorf("lead not found: %w", asynq.SkipRetry)
	}

	lead.Status = domain.StatusEnriquecendo
	if err := database.DB.Save(&lead).Error; err != nil {
		log.Printf("⚠️  Erro ao atualizar status para ENRIQUECENDO: %v", err)
		return err
	}

	log.Printf("📊 Lead '%s' agora está em status ENRIQUECENDO", payload.CompanyName)

	enrichErr := performLeadEnrichment(ctx, &lead)
	if enrichErr != nil {
		// Mark lead as failed so it counts as "done" for job completion purposes.
		database.DB.Model(&domain.Lead{}).Where("id = ?", payload.LeadID).
			Update("status", domain.StatusEnrichmentFailed)
		log.Printf("🚨 [EnrichLead] Lead %s marcado como ENRICHMENT_FAILED: %v", payload.LeadID, enrichErr)
	}

	// Always check if the job is fully done after every lead finishes (success or failure).
	if lead.ScrapingJobID != nil {
		checkJobCompletion(ctx, lead.ScrapingJobID.String())
	}

	// Enfileirar CNPJ assíncrono se necessário (depende do payload, feito aqui e não em performLeadEnrichment)
	if enrichErr == nil && lead.CNPJ == "" {
		if cnpjTask, err := NewEnrichCNPJTask(payload.LeadID, payload.CompanyName); err == nil {
			client := GetAsynqClient()
			if _, err := client.Enqueue(cnpjTask); err != nil {
				log.Printf("⚠️ [Worker] Falha ao enfileirar enrich:cnpj para %s: %v", payload.CompanyName, err)
			} else {
				log.Printf("📬 [Worker] enrich:cnpj enfileirado para: %s", payload.CompanyName)
			}
			client.Close()
		}
	}

	if enrichErr != nil {
		return enrichErr
	}
	return nil
}

// HandleEnrichCNPJTask executes CNPJ scraping independently, updating only CNPJ-related fields.
// Idempotent: skips if lead already has a CNPJ. Does not affect lead status.
func HandleEnrichCNPJTask(ctx context.Context, t *asynq.Task) error {
	var payload EnrichCNPJPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("json.Unmarshal failed: %v: %w", err, asynq.SkipRetry)
	}

	var lead domain.Lead
	if err := database.DB.First(&lead, "id = ?", payload.LeadID).Error; err != nil {
		return fmt.Errorf("lead not found: %w", asynq.SkipRetry)
	}
	if lead.CNPJ != "" {
		log.Printf("⏭️ [EnrichCNPJ] Lead %s já possui CNPJ. Pulando.", payload.LeadID)
		return nil
	}

	log.Printf("🔍 [EnrichCNPJ] Buscando CNPJ para: %s", payload.CompanyName)

	resp, err := searchCasaDosDadosWorker(payload.CompanyName)
	if err != nil {
		log.Printf("⚠️ [EnrichCNPJ] Erro ao buscar CNPJ: %v", err)
		return err // retryable
	}
	if resp == nil || resp.Dados.CNPJ == "" {
		log.Printf("⚠️ [EnrichCNPJ] CNPJ não encontrado para: %s", payload.CompanyName)
		return nil
	}

	updates := map[string]interface{}{"cnpj": resp.Dados.CNPJ}
	if resp.Dados.Email != "" {
		updates["email"] = resp.Dados.Email
	}
	if resp.Dados.Telefone != "" {
		updates["telefone"] = resp.Dados.Telefone
	}

	// WHERE cnpj = '' garante idempotência a nível de banco
	if err := database.DB.Model(&domain.Lead{}).Where("id = ? AND cnpj = ''", payload.LeadID).Updates(updates).Error; err != nil {
		log.Printf("⚠️ [EnrichCNPJ] Erro ao salvar CNPJ: %v", err)
		return err
	}

	log.Printf("✅ [EnrichCNPJ] CNPJ salvo para %s: %s", payload.CompanyName, resp.Dados.CNPJ)
	return nil
}

// FetchAndParseWebsite fetches the website HTML and extracts social media and tracking data.
// Now evolves into a smart depth-1 crawler.
func FetchAndParseWebsite(websiteURL, companyName string) (*WebsiteData, error) {
	client := &http.Client{
		Timeout: 5 * time.Second, // User requested 5s timeout for internal pages, let's use it for all
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
	}

	// 1. GET Homepage
	resp, err := client.Get(websiteURL)
	if err != nil {
		return nil, fmt.Errorf("HTTP GET homepage failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("homepage HTTP status %d", resp.StatusCode)
	}

	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	htmlHome := string(bodyBytes)

	// Extract data from homepage
	finalData := ExtractWebsiteData(htmlHome)
	finalData.PagesVisited = append(finalData.PagesVisited, websiteURL)

	// 2. Extract and prioritize internal links
	allLinks := ExtractInternalLinks(htmlHome, websiteURL)
	priorityLinks := PrioritizeLinks(allLinks)

	// 3. Crawl internal pages (max 3)
	for _, link := range priorityLinks {
		// Avoid loop (already visited)
		alreadyVisited := false
		for _, v := range finalData.PagesVisited {
			if v == link {
				alreadyVisited = true
				break
			}
		}
		if alreadyVisited {
			continue
		}

		// Controlled crawl
		innerResp, err := client.Get(link)
		if err != nil {
			log.Printf("⚠️  Falha ao carregar página interna %s: %v", link, err)
			continue
		}
		
		bodyBytes, _ := io.ReadAll(io.LimitReader(innerResp.Body, 1024*1024))
		innerResp.Body.Close()
		
		if innerResp.StatusCode == http.StatusOK {
			innerData := ExtractWebsiteData(string(bodyBytes))
			
			// Consolidate Data
			finalData.Emails = uniqueStrings(append(finalData.Emails, innerData.Emails...))
			finalData.Phones = uniqueStrings(append(finalData.Phones, innerData.Phones...))
			finalData.RawText += " " + innerData.RawText
			finalData.PagesVisited = append(finalData.PagesVisited, link)

			// Update social if missing
			if finalData.Instagram == "" && innerData.Instagram != "" {
				finalData.Instagram = innerData.Instagram
				finalData.SocialLinks["instagram"] = innerData.Instagram
			}
			if finalData.Facebook == "" && innerData.Facebook != "" {
				finalData.Facebook = innerData.Facebook
				finalData.SocialLinks["facebook"] = innerData.Facebook
			}
			for k, v := range innerData.SocialLinks {
				if _, ok := finalData.SocialLinks[k]; !ok {
					finalData.SocialLinks[k] = v
				}
			}
		}
	}

	// Final cleanup
	if len(finalData.RawText) > 10000 {
		finalData.RawText = finalData.RawText[:10000] // Safety limit
	}

	return finalData, nil
}

// searchCasaDosDadosWorker consome a Bridge API (Python) rodando no container 'sherlock'
func searchCasaDosDadosWorker(empresa string) (*SherlockCNPJResponse, error) {
	apiURL := "http://sherlock:8000/scrape-cnpj"
	
	payload := map[string]string{"termo": empresa}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 45 * time.Second} // Timeout estendido para scraping UI
	resp, err := client.Post(apiURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("falha na conexão com sherlock: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sherlock retornou status %d", resp.StatusCode)
	}

	var result SherlockCNPJResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("falha ao decodificar resposta: %w", err)
	}

	if !result.Success {
		return &result, fmt.Errorf("scraper reportou erro: %s", result.Message)
	}

	return &result, nil
}

// ExtractBusinessInsightsFallback gera insights estruturados via LLM quando não há website disponível.
// Usa dados do Google Reviews, nome da empresa e nicho como contexto alternativo.
func ExtractBusinessInsightsFallback(companyName, nicho string, googleData *GoogleData) (*BusinessInsights, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY não configurada")
	}

	var contextLines []string
	contextLines = append(contextLines, fmt.Sprintf("Empresa: %s", companyName))
	if nicho != "" {
		contextLines = append(contextLines, fmt.Sprintf("Nicho estimado: %s", nicho))
	}
	if googleData != nil {
		if googleData.NotaGeral != "" {
			contextLines = append(contextLines, fmt.Sprintf("Nota Google: %s", googleData.NotaGeral))
		}
		if googleData.TotalAvaliacoes != "" {
			contextLines = append(contextLines, fmt.Sprintf("Total de avaliações: %s", googleData.TotalAvaliacoes))
		}
		if len(googleData.ComentariosRecentes) > 0 {
			max := 3
			if len(googleData.ComentariosRecentes) < max {
				max = len(googleData.ComentariosRecentes)
			}
			contextLines = append(contextLines, "Comentários recentes:")
			for _, c := range googleData.ComentariosRecentes[:max] {
				contextLines = append(contextLines, fmt.Sprintf("  - %s", c))
			}
		}
	}

	context := strings.Join(contextLines, "\n")

	prompt := fmt.Sprintf(`Com base nas informações abaixo sobre uma empresa, infira e extraia os dados solicitados.
Responda APENAS em JSON válido com a estrutura abaixo, sem explicações ou markdown.

Estrutura esperada:
{
    "business_type": "tipo de negócio inferido (ex: Restaurante, Salão de Beleza, Advocacia)",
    "services": ["lista de serviços prováveis baseados no tipo de negócio"],
    "target_audience": "público-alvo provável",
    "tone": "tom de comunicação provável (formal, acolhedor, moderno, etc)",
    "marketing_level": "baixo, médio ou alto (inferido pela presença digital e avaliações)",
    "has_whatsapp": false
}

Dados da empresa:
---
%s
---`, context)

	resp, err := callGeminiGeneric(prompt, apiKey)
	if err != nil {
		return nil, err
	}

	resp = strings.TrimPrefix(resp, "```json")
	resp = strings.TrimPrefix(resp, "```")
	resp = strings.TrimSuffix(resp, "```")
	resp = strings.TrimSpace(resp)

	var insights BusinessInsights
	if err := json.Unmarshal([]byte(resp), &insights); err != nil {
		log.Printf("⚠️  Fallback: falha no parsing do JSON do LLM: %v | Resposta bruta: %s", err, resp)
		return nil, nil
	}

	insights.Validate()
	return &insights, nil
}

// ExtractBusinessInsights transforms raw website text into structured data using LLM.
func ExtractBusinessInsights(rawText string) (*BusinessInsights, error) {
	if rawText == "" {
		return nil, nil
	}

	// Limitar input (primeiros 3000 caracteres) para evitar estouro de contexto e custo
	textToAnalyze := rawText
	if len(textToAnalyze) > 3000 {
		textToAnalyze = textToAnalyze[:3000]
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY não configurada")
	}

	prompt := fmt.Sprintf(`Analise o seguinte texto de um site empresarial e extraia as informações solicitadas.
Responda APENAS em JSON válido com a estrutura abaixo, sem explicações ou markdown.

Estrutura esperada:
{
    "business_type": "tipo de negócio (ex: Restaurante, Advocacia, E-commerce)",
    "services": ["lista de serviços principais"],
    "target_audience": "público-alvo provável",
    "tone": "tom de comunicação (formal, moderno, agressivo, acolhedor, etc)",
    "marketing_level": "baixo, médio ou alto",
    "has_whatsapp": true/false (baseado em links ou menções)
}

Texto do site:
---
%s
---`, textToAnalyze)

	// Chamada ao LLM com parsing seguro
	resp, err := callGeminiGeneric(prompt, apiKey)
	if err != nil {
		return nil, err
	}

	// Limpar possíveis blocos de código markdown do LLM
	resp = strings.TrimPrefix(resp, "```json")
	resp = strings.TrimPrefix(resp, "```")
	resp = strings.TrimSuffix(resp, "```")
	resp = strings.TrimSpace(resp)

	var insights BusinessInsights
	if err := json.Unmarshal([]byte(resp), &insights); err != nil {
		log.Printf("⚠️  Falha no parsing do JSON do LLM: %v | Resposta bruta: %s", err, resp)
		return nil, nil // Retorna nil em caso de erro de parsing para não quebrar o pipeline
	}

	// Aplicar camada de validação e sanitização
	insights.Validate()

	return &insights, nil
}

// callGeminiGeneric is a helper for general purpose LLM calls.
func callGeminiGeneric(prompt, apiKey string) (string, error) {
	apiURL := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=%s",
		apiKey,
	)

	reqBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": []map[string]interface{}{
					{"text": prompt},
				},
			},
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Post(apiURL, "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("gemini error (%d): %s", resp.StatusCode, string(body))
	}

	var gemResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&gemResp); err != nil {
		return "", err
	}

	if len(gemResp.Candidates) == 0 || len(gemResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from gemini")
	}

	return gemResp.Candidates[0].Content.Parts[0].Text, nil
}

// ScoreLead calculates a 0-100 score representing the commercial opportunity.
func ScoreLead(lead domain.Lead) int {
	score := 0

	// 1. Presença Digital (Site e Instagram)
	if lead.Site != "" {
		score += 10
	} else {
		// Sem site é uma oportunidade maior de venda
		score += 25
	}

	if lead.Instagram != "" {
		score += 10
	} else {
		score += 20
	}

	// 2. MarketingLevel (extraído dos BusinessInsights no DeepData)
	if len(lead.DeepData) > 0 {
		var deepData DeepDataStructure
		if err := json.Unmarshal(lead.DeepData, &deepData); err == nil && deepData.Insights != nil {
			switch strings.ToLower(deepData.Insights.MarketingLevel) {
			case "baixo":
				score += 30
			case "medio", "médio":
				score += 15
			case "alto":
				score += 5
			}
		}
	}

	// 3. Dados Disponíveis (Facilidade de contato)
	if lead.Telefone != "" {
		score += 10
	}
	if lead.Email != "" {
		score += 10
	}

	// 4. Qualidade do site / Tracking
	if lead.Site != "" {
		// Se já investe (Pixel/GTM), a oportunidade de venda de infra básica é menor
		if lead.TemPixel || lead.TemGTM {
			score -= 10
		} else {
			score += 10
		}
	}

	// 5. Normalização (0-100)
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}

	return score
}
