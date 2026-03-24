package handlers

import (
	"encoding/json"
	"log"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/database"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
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

	log.Printf("🤖 Recebido pedido de análise de IA para lead: %s", leadID)

	// A. Buscar o lead no banco
	var lead domain.Lead
	if err := database.DB.First(&lead, "id = ?", leadID).Error; err != nil {
		log.Printf("⚠️  Lead não encontrado: %v", err)
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "lead not found",
		})
	}

	// B. Verificar se o lead foi enriquecido
	if lead.Status != domain.StatusEnriquecido {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":  "lead not enriched yet",
			"message": "O lead precisa estar com status ENRIQUECIDO para gerar análise de IA",
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

	// D. Montar input para análise de IA
	input := services.LeadAnalysisInput{
		Empresa:  lead.Empresa,
		Nicho:    lead.Nicho,
		Site:     lead.Site,
		TemPixel: lead.TemPixel,
		TemGTM:   lead.TemGTM,
	}

	// Extrai dados do Google Reviews (se existir)
	if deepData.Google != nil {
		input.NotaGoogle = deepData.Google.NotaGeral
		input.TotalReviews = deepData.Google.TotalAvaliacoes
		input.ComentariosRecentes = deepData.Google.ComentariosRecentes
	}

	// Extrai bio do Instagram (se existir)
	if deepData.Instagram != nil {
		input.BioInstagram = deepData.Instagram.Bio
	}

	log.Printf("🔍 Dados extraídos para análise: Empresa=%s, Nota=%s, Reviews=%s, Pixel=%v, GTM=%v",
		input.Empresa, input.NotaGoogle, input.TotalReviews, input.TemPixel, input.TemGTM)

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

	// F. Chamar serviço de IA com contexto da empresa
	analysis, err := h.aiService.GenerateLeadStrategy(input, settings)
	if err != nil {
		log.Printf("❌ Erro ao gerar análise de IA: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to generate AI analysis",
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
		"message": "AI analysis generated successfully",
		"lead_id": leadID,
		"analysis": analysis,
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
			"error": "no AI analysis found for this lead",
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
		"lead_id": leadID,
		"analysis": analysis,
	})
}
