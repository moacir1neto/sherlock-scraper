package handlers

import (
	"encoding/json"
	"log"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/database"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/queue"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/services"
	"github.com/gofiber/fiber/v2"
)

type AIHandler struct {
	aiService *services.AIService
}

func NewAIHandler(aiService *services.AIService) *AIHandler {
	return &AIHandler{aiService: aiService}
}

// AnalyzeLead gera análise de IA para um lead específico
// POST /api/v1/protected/leads/:id/analyze
func (h *AIHandler) AnalyzeLead(c *fiber.Ctx) error {
	leadID := c.Params("id")
	if leadID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "lead id is required",
		})
	}

	// Ler skill da query string (default: raiox)
	skill := c.Query("skill", "raiox")
	if skill != "raiox" && skill != "email" && skill != "call" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid skill",
			"message": "Skills válidas: raiox, email, call",
		})
	}

	log.Printf("🤖 Recebido pedido de análise de IA para lead: %s (skill: %s)", leadID, skill)

	// A. Buscar o lead no banco
	var lead domain.Lead
	if err := database.DB.First(&lead, "id = ?", leadID).Error; err != nil {
		log.Printf("⚠️  Lead não encontrado: %v", err)
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "lead not found",
		})
	}

	// B. Se o lead ainda está sendo enriquecido, avisa para esperar
	if lead.Status == domain.StatusEnriquecendo {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":          "lead is being enriched",
			"message":        "O lead está sendo enriquecido no momento. Aguarde a conclusão.",
			"current_status": lead.Status,
		})
	}

	// C. Extrair dados do DeepData (JSONB)
	var deepData queue.DeepDataStructure
	if lead.DeepData != nil {
		if err := json.Unmarshal(lead.DeepData, &deepData); err != nil {
			log.Printf("⚠️  Erro ao parsear DeepData: %v", err)
			// Continua mesmo com erro - pode não ter dados sociais
		}
	}

	// D. Montar input para análise de IA (ENRIQUECIDO)
	input := services.LeadAnalysisInput{
		Empresa:       lead.Empresa,
		Nicho:         lead.Nicho,
		Site:          lead.Site,
		TemPixel:      lead.TemPixel,
		TemGTM:        lead.TemGTM,
		Endereco:      lead.Endereco,
		Telefone:      lead.Telefone,
		TipoTelefone:  lead.TipoTelefone,
		LinkWhatsapp:  lead.LinkWhatsapp,
		Email:         lead.Email,
		ResumoNegocio: lead.ResumoNegocio,
		InstagramURL:  lead.Instagram,
		FacebookURL:   lead.Facebook,
		LinkedInURL:   lead.LinkedIn,
		TikTokURL:     lead.TikTok,
		YouTubeURL:    lead.YouTube,
	}

	// Extrai dados do Google Reviews (se existir)
	if deepData.Google != nil {
		input.NotaGoogle = deepData.Google.NotaGeral
		input.TotalReviews = deepData.Google.TotalAvaliacoes
		input.ComentariosRecentes = deepData.Google.ComentariosRecentes
	}

	// Extrai dados enriquecidos do Instagram (se existir)
	if deepData.Instagram != nil {
		input.BioInstagram = deepData.Instagram.Bio
		input.SeguidoresInstagram = deepData.Instagram.Followers
		input.SeguindoInstagram = deepData.Instagram.Following
		input.PostsRecentes = deepData.Instagram.Posts
		input.UltimoPostData = deepData.Instagram.LastPostDate
	}

	log.Printf("🔍 Dados extraídos para análise: Empresa=%s, Nota=%s, Reviews=%s, Pixel=%v, GTM=%v, Endereco=%s, Tel=%s",
		input.Empresa, input.NotaGoogle, input.TotalReviews, input.TemPixel, input.TemGTM, input.Endereco, input.Telefone)

	// E. Buscar configurações da empresa para contexto da IA
	var settings domain.CompanySetting
	if err := database.DB.First(&settings, 1).Error; err != nil {
		log.Printf("⚠️  CompanySetting não encontrado, usando defaults: %v", err)
		settings = domain.CompanySetting{
			CompanyName: "Sherlock Scraper",
			Niche:       "Software House",
			MainOffer:   "Desenvolvimento de sistemas web e mobile sob medida, com foco em automação de processos e integrações inteligentes.",
			ToneOfVoice: "Consultivo e Direto",
		}
	}

	// G. Chamar serviço de IA com contexto da empresa e skill selecionada
	analysis, err := h.aiService.GenerateLeadStrategy(input, settings, skill)
	if err != nil {
		log.Printf("❌ Erro ao gerar análise de IA: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to generate AI analysis",
			"details": err.Error(),
		})
	}

	// F. Salvar análise no banco (campo ai_analysis)
	analysisJSON, err := json.Marshal(analysis)
	if err != nil {
		log.Printf("⚠️  Erro ao serializar análise: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to serialize analysis",
		})
	}

	lead.AIAnalysis = analysisJSON
	if lead.Status != domain.StatusEnriquecido {
		lead.Status = domain.StatusEnriquecido
	}
	if err := database.DB.Save(&lead).Error; err != nil {
		log.Printf("⚠️  Erro ao salvar análise no banco: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to save analysis",
		})
	}

	log.Printf("✅ Análise de IA salva com sucesso para lead: %s (Score: %d/10)",
		leadID, analysis.ScoreMaturidade)

	// G. Retornar análise para o frontend
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":  "AI analysis generated successfully",
		"lead_id":  leadID,
		"analysis": analysis,
	})
}

// BulkAnalysisRequest representa o corpo da requisição para análise em massa
type BulkAnalysisRequest struct {
	LeadIds []string `json:"lead_ids"`
	Skill   string   `json:"skill"` // Opcional
}

// AnalyzeLeadsBulk processa múltiplos leads para análise de IA
// POST /api/v1/protected/leads/analyze/bulk
func (h *AIHandler) AnalyzeLeadsBulk(c *fiber.Ctx) error {
	var req BulkAnalysisRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	if len(req.LeadIds) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "no lead ids provided",
		})
	}

	skill := req.Skill
	if skill == "" {
		skill = "raiox"
	}

	log.Printf("🤖 Bulk AI Analysis requested for %d leads (skill: %s)", len(req.LeadIds), skill)

	// Buscar configurações da empresa (uma vez para todos)
	var settings domain.CompanySetting
	if err := database.DB.First(&settings, 1).Error; err != nil {
		log.Printf("⚠️  CompanySetting não encontrado, usando defaults: %v", err)
		settings = domain.CompanySetting{
			CompanyName: "Sherlock Scraper",
			Niche:       "Software House",
			MainOffer:   "Desenvolvimento de sistemas web e mobile sob medida, com foco em automação de processos e integrações inteligentes.",
			ToneOfVoice: "Consultivo e Direto",
		}
	}

	processedCount := 0
	errorCount := 0

	// Processamento em loop
	for _, id := range req.LeadIds {
		var lead domain.Lead
		if err := database.DB.First(&lead, "id = ?", id).Error; err != nil {
			log.Printf("⚠️  Skipping lead %s: not found", id)
			errorCount++
			continue
		}

		// Se o lead ainda está sendo enriquecido, pula
		if lead.Status == domain.StatusEnriquecendo {
			log.Printf("⚠️  Skipping lead %s: still being enriched", id)
			errorCount++
			continue
		}

		// Extrair dados do DeepData
		var deepData queue.DeepDataStructure
		if lead.DeepData != nil {
			json.Unmarshal(lead.DeepData, &deepData)
		}

		// Montar input (ENRIQUECIDO)
		input := services.LeadAnalysisInput{
			Empresa:       lead.Empresa,
			Nicho:         lead.Nicho,
			Site:          lead.Site,
			TemPixel:      lead.TemPixel,
			TemGTM:        lead.TemGTM,
			Endereco:      lead.Endereco,
			Telefone:      lead.Telefone,
			TipoTelefone:  lead.TipoTelefone,
			LinkWhatsapp:  lead.LinkWhatsapp,
			Email:         lead.Email,
			ResumoNegocio: lead.ResumoNegocio,
			InstagramURL:  lead.Instagram,
			FacebookURL:   lead.Facebook,
			LinkedInURL:   lead.LinkedIn,
			TikTokURL:     lead.TikTok,
			YouTubeURL:    lead.YouTube,
		}
		if deepData.Google != nil {
			input.NotaGoogle = deepData.Google.NotaGeral
			input.TotalReviews = deepData.Google.TotalAvaliacoes
			input.ComentariosRecentes = deepData.Google.ComentariosRecentes
		}
		if deepData.Instagram != nil {
			input.BioInstagram = deepData.Instagram.Bio
			input.SeguidoresInstagram = deepData.Instagram.Followers
			input.SeguindoInstagram = deepData.Instagram.Following
			input.PostsRecentes = deepData.Instagram.Posts
			input.UltimoPostData = deepData.Instagram.LastPostDate
		}

		// Gerar análise
		analysis, err := h.aiService.GenerateLeadStrategy(input, settings, skill)
		if err != nil {
			log.Printf("❌ Failed to analyze lead %s: %v", id, err)
			errorCount++
			continue
		}

		// Salvar no banco
		analysisJSON, _ := json.Marshal(analysis)
		lead.AIAnalysis = analysisJSON
		if lead.Status != domain.StatusEnriquecido {
			lead.Status = domain.StatusEnriquecido
		}
		if err := database.DB.Save(&lead).Error; err != nil {
			log.Printf("❌ Failed to save analysis for lead %s: %v", id, err)
			errorCount++
			continue
		}

		processedCount++
	}

	return c.JSON(fiber.Map{
		"message":   "Bulk processing completed",
		"processed": processedCount,
		"errors":    errorCount,
	})
}

// GetAnalysis retorna a análise de IA previamente gerada para um lead
// GET /api/v1/protected/leads/:id/analysis
func (h *AIHandler) GetAnalysis(c *fiber.Ctx) error {
	leadID := c.Params("id")
	if leadID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "lead id is required",
		})
	}

	// Buscar lead
	var lead domain.Lead
	if err := database.DB.First(&lead, "id = ?", leadID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "lead not found",
		})
	}

	// Verificar se tem análise
	if lead.AIAnalysis == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "no AI analysis found for this lead",
			"message": "Use POST /leads/:id/analyze para gerar uma análise",
		})
	}

	// Parse análise
	var analysis services.LeadAnalysisOutput
	if err := json.Unmarshal(lead.AIAnalysis, &analysis); err != nil {
		log.Printf("⚠️  Erro ao parsear análise salva: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to parse saved analysis",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"lead_id":  leadID,
		"analysis": analysis,
	})
}
