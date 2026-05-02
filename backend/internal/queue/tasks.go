package queue

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/config"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/database"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/logger"
	"github.com/digitalcombo/sherlock-scraper/backend/pkg/phoneutil"
	"github.com/hibiken/asynq"
	"go.uber.org/zap"
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
	TaskTypeEnrichLead  = "enrich:lead"
	TaskTypeBulkMessage = "lead:bulk-message"
	TaskTypeEnrichCNPJ  = "enrich:cnpj"
)

type EnrichLeadPayload struct {
	CompanyName string `json:"company_name"`
	LeadID      string `json:"lead_id"`
}

func GetAsynqClient() *asynq.Client {
	redisAddr := config.Get().RedisURL
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
	Type    string `json:"type"` // "start", "success", "error", "skip"
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
func publishEvent(ctx context.Context, campaignID, eventType, leadID, empresa, message string) {
	evt := CampaignEvent{
		Type:    eventType,
		LeadID:  leadID,
		Empresa: empresa,
		Message: message,
	}
	data, err := json.Marshal(evt)
	if err != nil {
		logger.FromContext(ctx).Error("falha_serializar_evento_campanha", zap.Error(err))
		return
	}
	PublishCampaignEvent(ctx, campaignID, string(data))
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

	ctx = logger.WithLeadID(ctx, payload.LeadID)
	ctx = logger.WithCompanyID(ctx, empresa)
	l := logger.FromContext(ctx)

	l.Info("bulk_message_started", zap.String("instance_id", payload.InstanceID))

	// 1. Evento START — notifica front-end que o processamento iniciou
	publishEvent(ctx, payload.CampaignID, "start", payload.LeadID, empresa,
		fmt.Sprintf("Iniciando envio para %s...", empresa))

	// 2. Validate phone number
	if payload.Phone == "" {
		l.Warn("lead_without_phone")
		publishEvent(ctx, payload.CampaignID, "skip", payload.LeadID, empresa,
			fmt.Sprintf("⚠️ %s sem telefone cadastrado", empresa))
		return fmt.Errorf("lead has no phone: %w", asynq.SkipRetry)
	}

	// 3. Normalize phone
	phone, normErr := phoneutil.NormalizeForWhatsApp(payload.Phone)
	if normErr != nil {
		l.Warn("invalid_phone", zap.String("raw_phone", payload.Phone))
		publishEvent(ctx, payload.CampaignID, "skip", payload.LeadID, empresa,
			fmt.Sprintf("⚠️ Telefone inválido para %s", empresa))
		return fmt.Errorf("invalid phone number for lead %s: %w", empresa, asynq.SkipRetry)
	}

	// 3.1 FAIL-FAST VALIDATION: Verificar se o número existe na Meta antes de tentar o envio
	exists, validatedJid, err := checkWhatsAppExistence(ctx, payload.InstanceID, phone)
	if err != nil {
		// Erro de rede ou timeout: Retornamos erro normal para o Asynq fazer retry agendado
		return fmt.Errorf("falha ao validar existência no whatsapp: %v", err)
	}

	if !exists {
		l.Warn("whatsapp_number_not_found", zap.String("phone", phone))
		publishEvent(ctx, payload.CampaignID, "skip", payload.LeadID, empresa,
			fmt.Sprintf("❌ Sem WhatsApp: Disparo cancelado para %s", empresa))

		// Atualiza o Lead no banco de dados para StatusPerdido
		dbErr := database.DB.Model(&domain.Lead{}).Where("id = ?", payload.LeadID).Updates(map[string]interface{}{
			"kanban_status":    domain.StatusPerdido,
			"notas_prospeccao": "Número sem WhatsApp (Fail-Fast Validated)",
		}).Error
		if dbErr != nil {
			l.Error("lead_status_update_failed", zap.Error(dbErr))
		}

		// Cancela a tarefa permanentemente no Asynq
		return fmt.Errorf("%w: número inexistente na Meta", asynq.SkipRetry)
	}

	// Se existe, usamos o JID oficial validado (corrige problemas de 9º dígito)
	phone = validatedJid
	l.Info("whatsapp_number_validated", zap.String("phone", phone))

	// 4. Converter payload string back temporariamente para domain.Lead para reaproveitar construção de mensagem
	leadMock := domain.Lead{Empresa: empresa, AIAnalysis: []byte(payload.AIAnalysis)}

	// 5. Extract icebreaker from AI analysis (if available)
	messageText := buildProspectionMessage(leadMock)
	l.Debug("message_built", zap.Int("message_length", len(messageText)))

	// 6. Send via WhatsMiau API
	if err := sendViaWhatsMiau(ctx, payload.InstanceID, phone, messageText); err != nil {
		l.Error("whatsmiau_send_failed", zap.Error(err))
		publishEvent(ctx, payload.CampaignID, "error", payload.LeadID, empresa,
			fmt.Sprintf("❌ Falha ao enviar para %s", empresa))
		return err // retryable — Asynq will retry
	}

	// NOTA ARQUITETURAL: Não atualizamos o Kanban aqui (database.DB.Model).
	// O WhatsMiau é dono do CRM e atualizará quando o Webhook/Disparo confirmar o envio.

	// 8. Evento SUCCESS — notifica front-end que o envio foi concluído
	publishEvent(ctx, payload.CampaignID, "success", payload.LeadID, empresa,
		fmt.Sprintf("✅ Enviado com sucesso para %s", empresa))

	l.Info("bulk_message_completed", zap.String("phone", phone))

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
func sendViaWhatsMiau(ctx context.Context, instanceID, phone, text string) error {
	apiURL := config.Get().WhatsmeowURL
	if apiURL == "" {
		apiURL = "http://whatsmiau-api:8080"
	}

	// WhatsMiau Evolution route is /v1/message/sendText/:instance
	endpoint := fmt.Sprintf("%s/v1/message/sendText/%s", apiURL, instanceID)

	body := map[string]interface{}{
		"number": phone,
		"text":   text,
		"delay":  1200, // Simula tempo de digitação
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
	if apiToken := config.Get().WhatsmeowAPIToken; apiToken != "" {
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

	logger.FromContext(ctx).Debug("whatsmiau_response",
		zap.Int("status", resp.StatusCode),
		zap.String("body", string(respBody)),
	)
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
func checkWhatsAppExistence(ctx context.Context, instanceID, phone string) (bool, string, error) {
	apiURL := config.Get().WhatsmeowURL
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
	if apiToken := config.Get().WhatsmeowAPIToken; apiToken != "" {
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
			data, err := FetchAndParseWebsite(ctx, lead.Site, companyName)
			if err != nil {
				logger.FromContext(ctx).Warn("website_inacessivel", zap.String("empresa", companyName), zap.Error(err))
				return nil
			}
			mu.Lock()
			result.WebsiteData = data
			mu.Unlock()
			return nil
		})
	}

	g1.Go(func() error {
		logger.FromContext(ctx).Info("buscando_google_reviews", zap.String("empresa", lead.Empresa))
		data, err := ScrapeGoogleReviews(ctx, lead.Empresa)
		if err != nil {
			logger.FromContext(ctx).Warn("google_reviews_falhou", zap.Error(err))
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
			logger.FromContext(ctx).Info("instagram_encontrado", zap.String("instagram", lead.Instagram))
		}
		if result.WebsiteData.Facebook != "" && lead.Facebook == "" {
			lead.Facebook = result.WebsiteData.Facebook
			logger.FromContext(ctx).Info("facebook_encontrado", zap.String("facebook", lead.Facebook))
		}
		lead.TemPixel = result.WebsiteData.TemPixel
		lead.TemGTM = result.WebsiteData.TemGTM
		if lead.TemPixel {
			logger.FromContext(ctx).Info("facebook_pixel_detectado")
		}
		if lead.TemGTM {
			logger.FromContext(ctx).Info("google_tag_manager_detectado")
		}
	}

	if !hasWebsite && lead.Instagram == "" && lead.Facebook == "" {
		logger.FromContext(ctx).Info("pulando_deep_enrichment_sem_website", zap.String("empresa", companyName))
		if result.GoogleData != nil {
			fallbackDeepData := &DeepDataStructure{Google: result.GoogleData}

			// Gerar Insights via LLM mesmo sem website, usando dados do Google
			insights, insErr := ExtractBusinessInsightsFallback(ctx, companyName, lead.Nicho, result.GoogleData)
			if insErr != nil {
				logger.FromContext(ctx).Warn("fallback_insights_falhou", zap.Error(insErr))
			} else if insights != nil {
				fallbackDeepData.Insights = insights
				logger.FromContext(ctx).Info("insights_fallback_extraidos",
					zap.String("business_type", insights.BusinessType),
					zap.String("marketing_level", insights.MarketingLevel),
				)
			}

			deepDataJSON, err := json.Marshal(fallbackDeepData)
			if err == nil && len(deepDataJSON) > 0 && json.Valid(deepDataJSON) {
				lead.DeepData = deepDataJSON
				logger.FromContext(ctx).Info("deep_data_fallback_salvo")
			} else {
				logger.FromContext(ctx).Warn("deep_data_fallback_invalido", zap.Error(err))
				lead.DeepData = nil
			}
		}
		syncGoogleToLead(lead, result.GoogleData)
		lead.Status = domain.StatusEnriquecido
		if err := database.DB.Save(lead).Error; err != nil {
			logger.FromContext(ctx).Error("falha_marcar_lead_enriquecido", zap.Error(err))
			return err
		}
		logger.FromContext(ctx).Info("lead_enriquecido_sem_website", zap.String("empresa", companyName))
		return nil
	}

	// ═══════════════════════════════════════════════════════════════
	// PHASE 2: Instagram + Facebook — em paralelo
	// ═══════════════════════════════════════════════════════════════
	logger.FromContext(ctx).Info("iniciando_deep_enrichment", zap.String("empresa", companyName))

	g2, _ := errgroup.WithContext(enrichCtx)

	if lead.Instagram != "" && strings.HasPrefix(lead.Instagram, "http") {
		g2.Go(func() error {
			logger.FromContext(ctx).Debug("extraindo_instagram")
			data := ScrapeInstagramProfile(ctx, lead.Instagram)
			mu.Lock()
			result.InstaData = data
			mu.Unlock()
			return nil
		})
	}

	if lead.Facebook != "" && strings.HasPrefix(lead.Facebook, "http") {
		g2.Go(func() error {
			logger.FromContext(ctx).Debug("extraindo_facebook")
			data := ScrapeFacebookPage(ctx, lead.Facebook)
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
			logger.FromContext(ctx).Info("instagram_extraido_sucesso")
		} else {
			logger.FromContext(ctx).Warn("instagram_extraido_erro", zap.String("error", result.InstaData.ErrorMessage))
		}
	}

	if result.FBData != nil {
		if result.FBData.Success {
			deepData.Facebook = &SocialPlatformData{
				Bio:          result.FBData.Bio,
				LastPostDate: result.FBData.LastPostDate,
				Posts:        result.FBData.RecentPosts,
			}
			logger.FromContext(ctx).Info("facebook_extraido_sucesso")
		} else {
			logger.FromContext(ctx).Warn("facebook_extraido_erro", zap.String("error", result.FBData.ErrorMessage))
		}
	}

	if result.GoogleData != nil {
		deepData.Google = result.GoogleData
		logger.FromContext(ctx).Info("google_reviews_consolidado",
			zap.String("nota", result.GoogleData.NotaGeral),
			zap.String("avaliacoes", result.GoogleData.TotalAvaliacoes),
			zap.Int("comentarios", len(result.GoogleData.ComentariosRecentes)),
		)
	}

	// ═══════════════════════════════════════════════════════════════
	// PHASE 3: Business Insights via LLM
	// ═══════════════════════════════════════════════════════════════
	if result.WebsiteData != nil && result.WebsiteData.RawText != "" {
		logger.FromContext(ctx).Info("extraindo_insights_llm")
		insights, err := ExtractBusinessInsights(ctx, result.WebsiteData.RawText)
		if err != nil {
			logger.FromContext(ctx).Warn("erro_extrair_insights_llm", zap.Error(err))
		} else if insights != nil {
			deepData.Insights = insights
			logger.FromContext(ctx).Info("insights_extraidos_llm",
				zap.String("tipo", insights.BusinessType),
				zap.String("marketing", insights.MarketingLevel),
				zap.Int("servicos_count", len(insights.Services)),
			)
		} else {
			logger.FromContext(ctx).Warn("llm_retornou_insights_nil", zap.Int("raw_text_len", len(result.WebsiteData.RawText)))
		}
	} else {
		logger.FromContext(ctx).Info("gerando_insights_fallback", zap.String("empresa", companyName))
		insights, err := ExtractBusinessInsightsFallback(ctx, companyName, lead.Nicho, result.GoogleData)
		if err != nil {
			logger.FromContext(ctx).Warn("erro_extrair_insights_fallback", zap.Error(err))
		} else if insights != nil {
			deepData.Insights = insights
			logger.FromContext(ctx).Info("insights_extraidos_fallback",
				zap.String("tipo", insights.BusinessType),
				zap.String("marketing", insights.MarketingLevel),
				zap.Int("servicos_count", len(insights.Services)),
			)
		} else {
			logger.FromContext(ctx).Warn("fallback_llm_retornou_insights_nil")
		}
	}

	if deepData.Instagram != nil || deepData.Facebook != nil || deepData.Google != nil || deepData.Insights != nil {
		deepDataJSON, err := json.Marshal(deepData)
		if err == nil && len(deepDataJSON) > 0 && json.Valid(deepDataJSON) {
			lead.DeepData = deepDataJSON
			logger.FromContext(ctx).Info("deep_data_validado_e_salvo")
		} else {
			logger.FromContext(ctx).Warn("deep_data_invalido_descartado", zap.Error(err))
			lead.DeepData = nil
		}
	} else {
		logger.FromContext(ctx).Warn("deep_data_vazio_nenhum_dado_coletado")
	}

	syncGoogleToLead(lead, result.GoogleData)
	lead.Score = ScoreLead(*lead)
	logger.FromContext(ctx).Info("lead_score_calculado", zap.Int("score", lead.Score))

	lead.Status = domain.StatusEnriquecido
	if err := database.DB.Save(lead).Error; err != nil {
		logger.FromContext(ctx).Error("falha_salvar_dados_enriquecidos", zap.Error(err))
		return err
	}

	// Validar persistência: confirmar que deep_data foi salvo no banco
	var savedLead domain.Lead
	if err := database.DB.Select("id, deep_data").First(&savedLead, "id = ?", lead.ID).Error; err != nil {
		logger.FromContext(ctx).Warn("falha_confirmar_persistencia_deep_data", zap.Error(err))
	} else if len(savedLead.DeepData) == 0 {
		logger.FromContext(ctx).Error("falha_deep_data_vazio_apos_save")
	} else {
		var check DeepDataStructure
		if err := json.Unmarshal(savedLead.DeepData, &check); err != nil {
			logger.FromContext(ctx).Error("deep_data_invalido_no_banco", zap.Error(err))
		} else {
			logger.FromContext(ctx).Info("deep_data_confirmado_no_banco",
				zap.Bool("insights", check.Insights != nil),
				zap.Bool("google", check.Google != nil),
				zap.Bool("instagram", check.Instagram != nil),
				zap.Bool("facebook", check.Facebook != nil),
			)
			if check.Insights == nil {
				logger.FromContext(ctx).Warn("insights_ausentes_no_deep_data_persistido")
			}
		}
	}

	// Invalidar cache de dossiê para forçar regeneração com dados atualizados
	if deepData.Insights != nil {
		if err := database.DB.WithContext(ctx).Where("lead_id = ?", lead.ID).Delete(&domain.LeadDossier{}).Error; err != nil {
			logger.FromContext(ctx).Warn("falha_invalidar_cache_dossie", zap.Error(err))
		} else {
			logger.FromContext(ctx).Debug("cache_dossie_invalidado")
		}
	}

	logger.FromContext(ctx).Info("enriquecimento_concluido",
		zap.Bool("pixel", lead.TemPixel),
		zap.Bool("gtm", lead.TemGTM),
		zap.Bool("google", deepData.Google != nil),
		zap.Int("score", lead.Score),
	)

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
		logger.FromContext(ctx).Warn("erro_contar_leads_pendentes", zap.Error(err))
		return
	}

	logger.FromContext(ctx).Info("job_progresso", zap.String("job_id", jobID), zap.Int64("pendentes", pending))

	if pending == 0 {
		res := database.DB.WithContext(ctx).Model(&domain.ScrapingJob{}).
			Where("id = ? AND status = ?", jobID, domain.ScrapeEnriching).
			Update("status", domain.ScrapeCompleted)
		if res.Error != nil {
			logger.FromContext(ctx).Error("job_completion_update_failed", zap.String("job_id", jobID), zap.Error(res.Error))
			return
		}
		if res.RowsAffected > 0 {
			logger.FromContext(ctx).Info("job_completed", zap.String("job_id", jobID))
		}
	}
}

func HandleEnrichLeadTask(ctx context.Context, t *asynq.Task) error {
	var payload EnrichLeadPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("json.Unmarshal failed: %v: %w", err, asynq.SkipRetry)
	}

	ctx = logger.WithLeadID(ctx, payload.LeadID)
	ctx = logger.WithCompanyID(ctx, payload.CompanyName)
	l := logger.Ctx(ctx)

	l.Info("enrich_lead_started")

	var lead domain.Lead
	if err := database.DB.First(&lead, "id = ?", payload.LeadID).Error; err != nil {
		l.Warn("lead_not_found", zap.Error(err))
		return fmt.Errorf("lead not found: %w", asynq.SkipRetry)
	}

	lead.Status = domain.StatusEnriquecendo
	if err := database.DB.Save(&lead).Error; err != nil {
		l.Error("status_update_failed", zap.Error(err))
		return err
	}

	l.Info("lead_status_updated", zap.String("status", string(domain.StatusEnriquecendo)))

	enrichErr := performLeadEnrichment(ctx, &lead)
	if enrichErr != nil {
		// Mark lead as failed so it counts as "done" for job completion purposes.
		database.DB.Model(&domain.Lead{}).Where("id = ?", payload.LeadID).
			Update("status", domain.StatusEnrichmentFailed)
		l.Error("enrichment_failed", zap.Error(enrichErr))
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
				l.Warn("cnpj_enqueue_failed", zap.Error(err))
			} else {
				l.Info("cnpj_task_enqueued")
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

	l := logger.FromContext(ctx)

	var lead domain.Lead
	if err := database.DB.First(&lead, "id = ?", payload.LeadID).Error; err != nil {
		return fmt.Errorf("lead not found: %w", asynq.SkipRetry)
	}
	if lead.CNPJ != "" {
		l.Info("lead_ja_possui_cnpj", zap.String("lead_id", payload.LeadID))
		return nil
	}

	l.Info("buscando_cnpj", zap.String("empresa", payload.CompanyName))

	resp, err := searchCasaDosDadosWorker(payload.CompanyName)
	if err != nil {
		l.Error("erro_buscar_cnpj", zap.Error(err))
		return err // retryable
	}
	if resp == nil || resp.Dados.CNPJ == "" {
		l.Warn("cnpj_nao_encontrado", zap.String("empresa", payload.CompanyName))
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
		l.Error("erro_salvar_cnpj", zap.Error(err))
		return err
	}

	l.Info("cnpj_salvo", zap.String("empresa", payload.CompanyName), zap.String("cnpj", resp.Dados.CNPJ))
	return nil
}

// FetchAndParseWebsite fetches the website HTML and extracts social media and tracking data.
// Now evolves into a smart depth-1 crawler.
func FetchAndParseWebsite(ctx context.Context, websiteURL, companyName string) (*WebsiteData, error) {
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
			logger.FromContext(ctx).Warn("falha_carregar_pagina_interna", zap.String("link", link), zap.Error(err))
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
func ExtractBusinessInsightsFallback(ctx context.Context, companyName, nicho string, googleData *GoogleData) (*BusinessInsights, error) {
	apiKey := config.Get().GeminiAPIKey
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
		logger.FromContext(ctx).Warn("falha_parsing_json_llm_fallback", zap.Error(err), zap.String("raw_resp", resp))
		return nil, nil
	}

	insights.Validate()
	return &insights, nil
}

// ExtractBusinessInsights transforms raw website text into structured data using LLM.
func ExtractBusinessInsights(ctx context.Context, rawText string) (*BusinessInsights, error) {
	if rawText == "" {
		return nil, nil
	}

	// Limitar input (primeiros 3000 caracteres) para evitar estouro de contexto e custo
	textToAnalyze := rawText
	if len(textToAnalyze) > 3000 {
		textToAnalyze = textToAnalyze[:3000]
	}

	apiKey := config.Get().GeminiAPIKey
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
		logger.FromContext(ctx).Warn("falha_parsing_json_llm", zap.Error(err), zap.String("raw_resp", resp))
		return nil, nil // Retorna nil em caso de erro de parsing para não quebrar o pipeline
	}

	// Aplicar camada de validação e sanitização
	insights.Validate()

	return &insights, nil
}

// callGeminiGeneric is a helper for general purpose LLM calls.
func callGeminiGeneric(prompt, apiKey string) (string, error) {
	apiURL := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=%s",
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
func syncGoogleToLead(lead *domain.Lead, g *GoogleData) {
	if g == nil {
		return
	}
	if g.NotaGeral != "" {
		normalized := strings.ReplaceAll(g.NotaGeral, ",", ".")
		if v, err := strconv.ParseFloat(normalized, 64); err == nil {
			lead.Rating = fmt.Sprintf("%.2f", v)
		}
	}
	if g.TotalAvaliacoes != "" {
		if v, err := strconv.Atoi(g.TotalAvaliacoes); err == nil {
			lead.QtdAvaliacoes = strconv.Itoa(v)
		}
	}
}

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
