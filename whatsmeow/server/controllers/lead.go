package controllers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	aiSettingsRepo "github.com/verbeux-ai/whatsmiau/repositories/ai_settings"
	"github.com/verbeux-ai/whatsmiau/repositories/leads"
	"github.com/verbeux-ai/whatsmiau/server/dto"
	"github.com/verbeux-ai/whatsmiau/services"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

type Lead struct {
	repo       interfaces.LeadRepository
	gemini     *services.GeminiService
	aiSettings *aiSettingsRepo.SQLAISettings
}

func NewLead(repo interfaces.LeadRepository, gemini *services.GeminiService, aiSettings *aiSettingsRepo.SQLAISettings) *Lead {
	return &Lead{repo: repo, gemini: gemini, aiSettings: aiSettings}
}

func (s *Lead) List(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	role, _ := c.Get("user_role").(string)

	// super_admin não tem company_id no JWT — pode listar todos os leads.
	// Demais roles precisam obrigatoriamente de company_id.
	if companyID == "" && role != "super_admin" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}

	status := c.QueryParam("status")
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit := 50
	offset := (page - 1) * limit

	list, total, err := s.repo.ListByCompanyID(c.Request().Context(), companyID, limit, offset, status)
	if err != nil {
		zap.L().Error("failed to list leads", zap.String("company_id", companyID), zap.Error(err))
		return utils.HTTPFail(c, http.StatusInternalServerError, nil, "failed to list leads")
	}
	if list == nil {
		list = []models.Lead{}
	}

	return c.JSON(http.StatusOK, dto.LeadListResponse{
		Leads: list,
		Total: total,
		Page:  page,
		Limit: limit,
	})
}

func (s *Lead) Create(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}

	var req dto.CreateLeadRequest
	if err := c.Bind(&req); err != nil {
		return utils.HTTPFail(c, http.StatusUnprocessableEntity, err, "invalid body")
	}
	if err := validator.New().Struct(&req); err != nil {
		return utils.HTTPFail(c, http.StatusBadRequest, err, "validation failed")
	}

	lead := &models.Lead{
		CompanyID:        companyID,
		SourceID:         req.SourceID,
		Name:             req.Name,
		Phone:            req.Phone,
		Address:          req.Address,
		Website:          req.Website,
		Email:            req.Email,
		Rating:           req.Rating,
		Reviews:          req.Reviews,
		KanbanStatus:     "prospeccao",
		EnrichmentStatus: "CAPTURADO",
		CreatedAt:        time.Now(),
	}

	if err := s.repo.Create(c.Request().Context(), lead); err != nil {
		zap.L().Error("failed to create lead", zap.String("company_id", companyID), zap.Error(err))
		return utils.HTTPFail(c, http.StatusInternalServerError, nil, "failed to create lead")
	}
	return c.JSON(http.StatusCreated, lead)
}

func (s *Lead) BulkCreate(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}

	var req dto.BulkCreateLeadsRequest
	if err := c.Bind(&req); err != nil {
		return utils.HTTPFail(c, http.StatusUnprocessableEntity, err, "invalid body")
	}
	if err := validator.New().Struct(&req); err != nil {
		return utils.HTTPFail(c, http.StatusBadRequest, err, "validation failed")
	}

	batch := make([]*models.Lead, 0, len(req.Leads))
	now := time.Now()
	for _, item := range req.Leads {
		batch = append(batch, &models.Lead{
			CompanyID:        companyID,
			SourceID:         req.SourceID,
			Name:             item.Name,
			Phone:            item.Phone,
			Address:          item.Address,
			Website:          item.Website,
			Email:            item.Email,
			Rating:           item.Rating,
			Reviews:          item.Reviews,
			KanbanStatus:     "prospeccao",
			EnrichmentStatus: "CAPTURADO",
			CreatedAt:        now,
		})
	}

	if err := s.repo.BulkCreate(c.Request().Context(), batch); err != nil {
		zap.L().Error("failed to bulk create leads", zap.String("company_id", companyID), zap.Int("count", len(batch)), zap.Error(err))
		return utils.HTTPFail(c, http.StatusInternalServerError, nil, "failed to bulk create leads")
	}
	return c.JSON(http.StatusCreated, map[string]int{"created": len(batch)})
}

func (s *Lead) GetByID(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}

	id := c.Param("id")
	lead, err := s.repo.GetByID(c.Request().Context(), id, companyID)
	if err != nil {
		if err == leads.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, nil, "lead not found")
		}
		zap.L().Error("failed to get lead", zap.String("id", id), zap.String("company_id", companyID), zap.Error(err))
		return utils.HTTPFail(c, http.StatusInternalServerError, nil, "failed to get lead")
	}
	return c.JSON(http.StatusOK, lead)
}

func (s *Lead) Update(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}

	id := c.Param("id")
	var req dto.UpdateLeadRequest
	if err := c.Bind(&req); err != nil {
		return utils.HTTPFail(c, http.StatusUnprocessableEntity, err, "invalid body")
	}
	if err := validator.New().Struct(&req); err != nil {
		return utils.HTTPFail(c, http.StatusBadRequest, err, "validation failed")
	}

	existing, err := s.repo.GetByID(c.Request().Context(), id, companyID)
	if err != nil {
		if err == leads.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, nil, "lead not found")
		}
		zap.L().Error("failed to get lead for update", zap.String("id", id), zap.String("company_id", companyID), zap.Error(err))
		return utils.HTTPFail(c, http.StatusInternalServerError, nil, "failed to get lead")
	}

	existing.Name = req.Name
	existing.Phone = req.Phone
	existing.Address = req.Address
	existing.Website = req.Website
	existing.Email = req.Email
	existing.Notes = req.Notes
	existing.EstimatedValue = req.EstimatedValue
	existing.Tags = req.Tags
	if req.KanbanStatus != "" {
		existing.KanbanStatus = req.KanbanStatus
	}

	if err := s.repo.Update(c.Request().Context(), existing); err != nil {
		if err == leads.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, nil, "lead not found")
		}
		zap.L().Error("failed to update lead", zap.String("id", id), zap.String("company_id", companyID), zap.Error(err))
		return utils.HTTPFail(c, http.StatusInternalServerError, nil, "failed to update lead")
	}
	return c.JSON(http.StatusOK, existing)
}

func (s *Lead) UpdateStatus(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}

	id := c.Param("id")
	var req dto.UpdateLeadStatusRequest
	if err := c.Bind(&req); err != nil {
		return utils.HTTPFail(c, http.StatusUnprocessableEntity, err, "invalid body")
	}
	if err := validator.New().Struct(&req); err != nil {
		return utils.HTTPFail(c, http.StatusBadRequest, err, "validation failed")
	}

	if err := s.repo.UpdateStatus(c.Request().Context(), id, companyID, req.KanbanStatus); err != nil {
		if err == leads.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, nil, "lead not found")
		}
		zap.L().Error("failed to update lead status", zap.String("id", id), zap.String("company_id", companyID), zap.Error(err))
		return utils.HTTPFail(c, http.StatusInternalServerError, nil, "failed to update lead status")
	}
	return c.JSON(http.StatusOK, map[string]string{"status": req.KanbanStatus})
}

func (s *Lead) Delete(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}

	id := c.Param("id")
	if err := s.repo.Delete(c.Request().Context(), id, companyID); err != nil {
		if err == leads.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, nil, "lead not found")
		}
		zap.L().Error("failed to delete lead", zap.String("id", id), zap.String("company_id", companyID), zap.Error(err))
		return utils.HTTPFail(c, http.StatusInternalServerError, nil, "failed to delete lead")
	}
	return c.NoContent(http.StatusNoContent)
}

// ListByScrape retorna todos os leads de uma campanha de raspagem específica.
func (s *Lead) ListByScrape(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	scrapeID := c.Param("scrape_id")

	list, err := s.repo.ListByScrapeID(c.Request().Context(), scrapeID, companyID)
	if err != nil {
		zap.L().Error("failed to list leads by scrape", zap.String("scrape_id", scrapeID), zap.Error(err))
		return utils.HTTPFail(c, http.StatusInternalServerError, nil, "failed to list leads")
	}
	if list == nil {
		list = []models.Lead{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"leads": list, "total": len(list)})
}

// AnalyzeBulk enfileira a geração de dossiês IA para múltiplos leads em background.
// Retorna 202 imediatamente — o processamento continua independente do ciclo de vida do request.
func (s *Lead) AnalyzeBulk(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}

	var req dto.BulkAnalyzeRequest
	if err := c.Bind(&req); err != nil {
		return utils.HTTPFail(c, http.StatusUnprocessableEntity, err, "invalid body")
	}
	if err := validator.New().Struct(&req); err != nil {
		return utils.HTTPFail(c, http.StatusBadRequest, err, "validation failed")
	}

	skill := req.Skill
	if skill == "" {
		skill = "raiox"
	}

	// Desacopla do request context: o processamento continua mesmo se o usuário navegar
	go s.runBulkAnalysis(companyID, req.IDs, skill)

	return c.JSON(http.StatusAccepted, map[string]interface{}{
		"queued":  len(req.IDs),
		"status":  "processing",
		"message": "Análise iniciada em background. Os dossiês serão gerados automaticamente.",
	})
}

func (s *Lead) runBulkAnalysis(companyID string, ids []string, skill string) {
	ctx := context.Background()

	// Busca o contexto de IA da empresa uma única vez
	aiCfg := &models.AISettings{}
	if s.aiSettings != nil {
		if cfg, err := s.aiSettings.GetByCompanyID(ctx, companyID); err == nil {
			aiCfg = cfg
		} else {
			zap.L().Warn("bulk analyze: could not load ai_settings", zap.String("company_id", companyID), zap.Error(err))
		}
	}

	processed, failed := 0, 0
	for _, id := range ids {
		lead, err := s.repo.GetByID(ctx, id, companyID)
		if err != nil {
			zap.L().Warn("bulk analyze: lead not found", zap.String("id", id), zap.Error(err))
			failed++
			continue
		}

		input := services.LeadAnalysisInput{
			Empresa:        lead.Name,
			Nicho:          lead.Nicho,
			ResumoNegocio:  lead.Resumo,
			Endereco:       lead.Address,
			Telefone:       lead.Phone,
			TipoTelefone:   lead.TipoTelefone,
			LinkWhatsapp:   lead.LinkWhatsapp,
			Email:          lead.Email,
			Site:           lead.Website,
			Rating:         strconv.FormatFloat(lead.Rating, 'f', 1, 64),
			Reviews:        strconv.Itoa(lead.Reviews),
			Instagram:      lead.Instagram,
			Facebook:       lead.Facebook,
			LinkedIn:       lead.LinkedIn,
			TikTok:         lead.TikTok,
			YouTube:        lead.YouTube,
			VendedorNome:   aiCfg.CompanyName,
			VendedorNicho:  aiCfg.Nicho,
			VendedorOferta: aiCfg.Oferta,
			VendedorTom:    aiCfg.TomDeVoz,
		}

		output, err := s.gemini.GenerateLeadStrategy(input, skill)
		if err != nil {
			zap.L().Warn("bulk analyze: gemini failed", zap.String("lead_id", id), zap.Error(err))
			failed++
			continue
		}

		analysisJSON, _ := json.Marshal(output)
		if err := s.repo.UpdateAIAnalysis(ctx, id, companyID, string(analysisJSON)); err != nil {
			zap.L().Warn("bulk analyze: failed to persist ai_analysis", zap.String("lead_id", id), zap.Error(err))
		}
		processed++
		zap.L().Info("bulk analyze: lead processed", zap.String("lead_id", id), zap.Int("processed", processed), zap.Int("total", len(ids)))
	}

	zap.L().Info("bulk analyze: completed", zap.String("company_id", companyID), zap.Int("processed", processed), zap.Int("failed", failed))
}

// Analyze gera o dossiê de inteligência IA para um lead via Gemini.
// Query param: ?skill=raiox|email|call (padrão: raiox)
func (s *Lead) Analyze(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}

	id := c.Param("id")
	skill := c.QueryParam("skill")
	if skill == "" {
		skill = "raiox"
	}

	lead, err := s.repo.GetByID(c.Request().Context(), id, companyID)
	if err != nil {
		if err == leads.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, nil, "lead not found")
		}
		zap.L().Error("failed to get lead for analysis", zap.String("id", id), zap.Error(err))
		return utils.HTTPFail(c, http.StatusInternalServerError, nil, "failed to get lead")
	}

	// Busca o contexto de IA da empresa (defaults vazios se não configurado)
	aiCfg := &models.AISettings{}
	if s.aiSettings != nil {
		if cfg, err := s.aiSettings.GetByCompanyID(c.Request().Context(), companyID); err == nil {
			aiCfg = cfg
		} else {
			zap.L().Warn("could not load ai_settings for analyze", zap.String("company_id", companyID), zap.Error(err))
		}
	}

	input := services.LeadAnalysisInput{
		Empresa:       lead.Name,
		Nicho:         lead.Nicho,
		ResumoNegocio: lead.Resumo,
		Endereco:      lead.Address,
		Telefone:      lead.Phone,
		TipoTelefone:  lead.TipoTelefone,
		LinkWhatsapp:  lead.LinkWhatsapp,
		Email:         lead.Email,
		Site:          lead.Website,
		Rating:        strconv.FormatFloat(lead.Rating, 'f', 1, 64),
		Reviews:       strconv.Itoa(lead.Reviews),
		Instagram:     lead.Instagram,
		Facebook:      lead.Facebook,
		LinkedIn:      lead.LinkedIn,
		TikTok:        lead.TikTok,
		YouTube:       lead.YouTube,
		// Contexto personalizado do vendedor
		VendedorNome:   aiCfg.CompanyName,
		VendedorNicho:  aiCfg.Nicho,
		VendedorOferta: aiCfg.Oferta,
		VendedorTom:    aiCfg.TomDeVoz,
	}

	zap.L().Info("generating AI dossier", zap.String("lead_id", id), zap.String("skill", skill))

	output, err := s.gemini.GenerateLeadStrategy(input, skill)
	if err != nil {
		zap.L().Error("gemini analysis failed", zap.String("lead_id", id), zap.Error(err))
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to generate AI analysis")
	}

	// Persiste o dossiê como JSON no campo ai_analysis do lead
	analysisJSON, _ := json.Marshal(output)
	if err := s.repo.UpdateAIAnalysis(c.Request().Context(), id, companyID, string(analysisJSON)); err != nil {
		zap.L().Warn("failed to persist ai_analysis", zap.String("lead_id", id), zap.Error(err))
	}

	return c.JSON(http.StatusOK, output)
}
