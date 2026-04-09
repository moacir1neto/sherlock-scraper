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
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/database"
	"github.com/digitalcombo/sherlock-scraper/backend/pkg/phoneutil"
	"github.com/hibiken/asynq"
)

// SherlockCNPJResponse mapeia o retorno do microserviço bridge_api.py
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
)

// EnrichLeadPayload contains data for the enrich lead task
type EnrichLeadPayload struct {
	CompanyName string `json:"company_name"`
	LeadID      string `json:"lead_id"`
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

// HandleEnrichLeadTask processes the enrich lead task
func HandleEnrichLeadTask(ctx context.Context, t *asynq.Task) error {
	var payload EnrichLeadPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("json.Unmarshal failed: %v: %w", err, asynq.SkipRetry)
	}

	log.Printf("🔄 Processing task LEAD_ENRICH:%s (%s)", payload.LeadID, payload.CompanyName)

	// A. Buscar o Lead no banco de dados
	var lead domain.Lead
	if err := database.DB.First(&lead, "id = ?", payload.LeadID).Error; err != nil {
		log.Printf("⚠️  Erro ao buscar lead %s: %v", payload.LeadID, err)
		return fmt.Errorf("lead not found: %w", asynq.SkipRetry)
	}

	// B. Atualizar status para ENRIQUECENDO
	lead.Status = domain.StatusEnriquecendo
	if err := database.DB.Save(&lead).Error; err != nil {
		log.Printf("⚠️  Erro ao atualizar status para ENRIQUECENDO: %v", err)
		return err
	}

	log.Printf("📊 Lead '%s' agora está em status ENRIQUECENDO", payload.CompanyName)

	// --- 🩺 INÍCIO DA CIRURGIA: BUSCA AUTOMÁTICA DE CNPJ ---
	if lead.CNPJ == "" {
		log.Printf("🔍 [Worker] Buscando CNPJ em background para: %s", lead.Empresa)
		
		log.Printf("🔍 [Worker] Solicitando enriquecimento via Sherlock API: %s", lead.Empresa)
		
		cnpjDetail, err := searchCasaDosDadosWorker(lead.Empresa)
		
		if err == nil && cnpjDetail != nil && cnpjDetail.Dados.CNPJ != "" {
			lead.CNPJ = cnpjDetail.Dados.CNPJ
			
			// Enriquecimento opcional de campos se vierem da Casa dos Dados e estiverem vazios
			updates := map[string]interface{}{"cnpj": lead.CNPJ}
			
			if cnpjDetail.Dados.Email != "" && lead.Email == "" {
				lead.Email = cnpjDetail.Dados.Email
				updates["email"] = lead.Email
			}
			
			if cnpjDetail.Dados.Telefone != "" && lead.Telefone == "" {
				lead.Telefone = cnpjDetail.Dados.Telefone
				updates["telefone"] = lead.Telefone
			}

			database.DB.Model(&lead).Updates(updates)
			log.Printf("✅ [Worker] Dados vinculados com sucesso via Sherlock (CNPJ: %s)", lead.CNPJ)
		} else {
			log.Printf("⚠️ [Worker] Sherlock não retornou dados (seguindo com fallback): %v", err)
		}
	}
	// --- 🩺 FIM DA CIRURGIA ---

	// C. Verificar se o Lead possui um Website
	if lead.Site == "" || !strings.HasPrefix(strings.ToLower(lead.Site), "http") {
		log.Printf("⏭️  Lead '%s' não possui website válido. Pulando enriquecimento web.", payload.CompanyName)

		// Marca como enriquecido mesmo sem dados adicionais
		lead.Status = domain.StatusEnriquecido
		if err := database.DB.Save(&lead).Error; err != nil {
			log.Printf("⚠️  Erro ao marcar lead como ENRIQUECIDO: %v", err)
			return err
		}

		log.Printf("✅ Lead '%s' marcado como ENRIQUECIDO (sem website)", payload.CompanyName)
		return nil
	}

	// D. Fazer requisição HTTP GET para o Website (timeout 10s)
	enrichmentData, err := fetchAndParseWebsite(lead.Site, payload.CompanyName)
	if err != nil {
		log.Printf("⚠️  Erro ao buscar website de '%s': %v", payload.CompanyName, err)

		// Mesmo com erro, marca como enriquecido para não bloquear
		lead.Status = domain.StatusEnriquecido
		if err := database.DB.Save(&lead).Error; err != nil {
			log.Printf("⚠️  Erro ao marcar lead como ENRIQUECIDO após falha: %v", err)
			return err
		}

		log.Printf("⚠️  Lead '%s' marcado como ENRIQUECIDO (website inacessível)", payload.CompanyName)
		return nil
	}

	// E. Atualizar dados do Lead com informações extraídas
	if enrichmentData.Instagram != "" && lead.Instagram == "" {
		lead.Instagram = enrichmentData.Instagram
		log.Printf("📷 Instagram encontrado: %s", enrichmentData.Instagram)
	}

	if enrichmentData.Facebook != "" && lead.Facebook == "" {
		lead.Facebook = enrichmentData.Facebook
		log.Printf("👥 Facebook encontrado: %s", enrichmentData.Facebook)
	}

	lead.TemPixel = enrichmentData.TemPixel
	if enrichmentData.TemPixel {
		log.Printf("🎯 Facebook Pixel detectado!")
	}

	lead.TemGTM = enrichmentData.TemGTM
	if enrichmentData.TemGTM {
		log.Printf("📈 Google Tag Manager detectado!")
	}

	// F. DEEP ENRICHMENT - Scrape social media profiles
	log.Printf("🕵️  Iniciando Deep Enrichment para: %s", payload.CompanyName)

	// Initialize DeepData structure
	deepData := &DeepDataStructure{}

	// Scrape Instagram if available
	if lead.Instagram != "" && strings.HasPrefix(lead.Instagram, "http") {
		log.Printf("🔍 Extraindo inteligência do Instagram...")
		socialData := ScrapeInstagramProfile(lead.Instagram)

		if socialData.Success {
			deepData.Instagram = &SocialPlatformData{
				Bio:          socialData.Bio,
				LastPostDate: socialData.LastPostDate,
				Posts:        socialData.RecentPosts,
			}
			log.Printf("✨ Deep intelligence extraída do Instagram!")
		} else {
			log.Printf("⚠️  Instagram: %s", socialData.ErrorMessage)
		}
	}

	// Scrape Facebook if available (parallel to Instagram)
	if lead.Facebook != "" && strings.HasPrefix(lead.Facebook, "http") {
		log.Printf("🔍 Extraindo inteligência do Facebook...")
		socialData := ScrapeFacebookPage(lead.Facebook)

		if socialData.Success {
			deepData.Facebook = &SocialPlatformData{
				Bio:          socialData.Bio,
				LastPostDate: socialData.LastPostDate,
				Posts:        socialData.RecentPosts,
			}
			log.Printf("✨ Deep intelligence extraída do Facebook!")
		} else {
			log.Printf("⚠️  Facebook: %s", socialData.ErrorMessage)
		}
	}

	// ═══════════════════════════════════════════════════════════════
	// GOOGLE REVIEWS EXTRACTION
	// ═══════════════════════════════════════════════════════════════
	log.Printf("🔍 Iniciando extração de avaliações do Google para: %s", lead.Empresa)
	googleData, errGoogle := ScrapeGoogleReviews(lead.Empresa)

	if errGoogle != nil {
		log.Printf("⚠️  Aviso: Não foi possível extrair dados do Google: %v", errGoogle)
	} else if googleData != nil {
		deepData.Google = googleData
		log.Printf("✨ Google Reviews extraído com sucesso! (Nota: %s, Avaliações: %s, Comentários: %d)",
			googleData.NotaGeral, googleData.TotalAvaliacoes, len(googleData.ComentariosRecentes))
	}

	// Save DeepData as JSONB
	if deepData.Instagram != nil || deepData.Facebook != nil {
		deepDataJSON, err := json.Marshal(deepData)
		if err != nil {
			log.Printf("⚠️  Erro ao serializar DeepData: %v", err)
		} else {
			lead.DeepData = deepDataJSON
			log.Printf("💾 DeepData salvo em JSONB")
		}
	}

	// G. Marcar como ENRIQUECIDO
	lead.Status = domain.StatusEnriquecido

	// H. Salvar no banco de dados
	if err := database.DB.Save(&lead).Error; err != nil {
		log.Printf("⚠️  Erro ao salvar dados enriquecidos: %v", err)
		return err
	}

	log.Printf("✨ Enriquecimento concluído para: %s (Pixel: %v, GTM: %v, Google Reviews: %v)",
		payload.CompanyName, lead.TemPixel, lead.TemGTM, deepData.Google != nil)

	return nil
}

// fetchAndParseWebsite fetches the website HTML and extracts social media and tracking data
func fetchAndParseWebsite(websiteURL, companyName string) (*EnrichmentData, error) {
	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			// Allow up to 5 redirects
			if len(via) >= 5 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
	}

	// Make GET request
	resp, err := client.Get(websiteURL)
	if err != nil {
		return nil, fmt.Errorf("HTTP GET failed: %w", err)
	}
	defer resp.Body.Close()

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP status %d", resp.StatusCode)
	}

	// Read response body (limit to 1MB to avoid memory issues)
	limitedReader := io.LimitReader(resp.Body, 1024*1024) // 1MB limit
	bodyBytes, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	htmlBody := string(bodyBytes)

	// Extract data using helper functions
	enrichmentData := ExtractSocialAndTracking(htmlBody)

	return enrichmentData, nil
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
