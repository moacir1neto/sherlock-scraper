package controllers

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	scrapeRepo "github.com/verbeux-ai/whatsmiau/repositories/scrapes"
	"github.com/verbeux-ai/whatsmiau/server/dto"
	"github.com/verbeux-ai/whatsmiau/services"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

type Sherlock struct {
	service    *services.SherlockService
	scrapeRepo interfaces.ScrapeRepository
	leadRepo   interfaces.LeadRepository
}

func NewSherlock(service *services.SherlockService, scrapeRepo interfaces.ScrapeRepository, leadRepo interfaces.LeadRepository) *Sherlock {
	return &Sherlock{
		service:    service,
		scrapeRepo: scrapeRepo,
		leadRepo:   leadRepo,
	}
}

// Extract inicia uma campanha de raspagem de forma assíncrona.
// Cria o registro de scrape imediatamente (status=running) e retorna o scrape_id.
// A extração e salvamento dos leads ocorrem em background.
func (s *Sherlock) Extract(ctx echo.Context) error {
	companyID, _ := ctx.Get("company_id").(string)
	userID, _ := ctx.Get("user_id").(string)
	userRole, _ := ctx.Get("user_role").(string)

	var request dto.ExtractLeadsRequest
	if err := ctx.Bind(&request); err != nil {
		zap.L().Warn("failed to bind request body", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	// Se for super_admin, permite passar company_id no body
	if companyID == "" && userRole == "super_admin" {
		companyID = request.CompanyID
	}

	if companyID == "" {
		return utils.HTTPFail(ctx, http.StatusForbidden, nil, "company_id required")
	}
	if err := validator.New().Struct(&request); err != nil {
		zap.L().Warn("invalid request body", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}

	// Cria o registro de campanha imediatamente
	scrape := &models.Scrape{
		CompanyID: companyID,
		UserID:    userID,
		Keyword:   request.Keyword,
		Location:  request.Location,
		Status:    "running",
	}
	if err := s.scrapeRepo.Create(ctx.Request().Context(), scrape); err != nil {
		zap.L().Error("failed to create scrape record", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to start scraping campaign")
	}

	zap.L().Info("scraping campaign created",
		zap.String("scrape_id", scrape.ID),
		zap.String("keyword", request.Keyword),
		zap.String("location", request.Location),
	)

	// Extração e salvamento em background
	go s.runExtraction(scrape.ID, companyID, request)

	return ctx.JSON(http.StatusAccepted, map[string]string{
		"scrape_id": scrape.ID,
		"status":    "running",
		"message":   "Campanha iniciada. Use o scrape_id para acompanhar o status.",
	})
}

func (s *Sherlock) runExtraction(scrapeID, companyID string, request dto.ExtractLeadsRequest) {
	ctx := context.Background()

	result, err := s.service.ExtractLeads(request)
	if err != nil {
		zap.L().Error("extraction failed", zap.String("scrape_id", scrapeID), zap.Error(err))
		if updateErr := s.scrapeRepo.UpdateStatus(ctx, scrapeID, "error", 0); updateErr != nil {
			zap.L().Warn("failed to update scrape status to error", zap.Error(updateErr))
		}
		return
	}

	// Converte os leads do DTO para models e salva no banco
	now := time.Now()
	batch := make([]*models.Lead, 0, len(result.Leads))
	for _, l := range result.Leads {
		rating := parseRating(l.Rating)
		reviews := parseReviews(l.Reviews)
		lead := &models.Lead{
			CompanyID:        companyID,
			ScrapeID:         scrapeID,
			SourceID:         "sherlock",
			Name:             l.Name,
			Phone:            l.Phone,
			Address:          l.Address,
			Website:          l.Website,
			Email:            l.Email,
			Instagram:        l.Instagram,
			Facebook:         l.Facebook,
			LinkedIn:         l.LinkedIn,
			TikTok:           l.TikTok,
			YouTube:          l.YouTube,
			TipoTelefone:     l.TipoTelefone,
			LinkWhatsapp:     l.LinkWhatsapp,
			Rating:           rating,
			Reviews:          reviews,
			Nicho:            request.Keyword,
			CNPJ:             l.CNPJ,
			HasPixel:         l.HasPixel,
			HasGTM:           l.HasGTM,
			KanbanStatus:     "prospeccao",
			EnrichmentStatus: "CAPTURADO",
			DeepData:         l.DeepData,
			CreatedAt:        now,
		}
		if rating == 0 && reviews == 0 && len(l.DeepData) == 0 {
			zap.L().Warn("lead imported with no enrichment data", zap.String("name", l.Name))
		}
		batch = append(batch, lead)
	}

	if len(batch) > 0 {
		if err := s.leadRepo.BulkCreate(ctx, batch); err != nil {
			zap.L().Error("failed to bulk save leads", zap.String("scrape_id", scrapeID), zap.Error(err))
			_ = s.scrapeRepo.UpdateStatus(ctx, scrapeID, "error", 0)
			return
		}
	}

	if err := s.scrapeRepo.UpdateStatus(ctx, scrapeID, "completed", len(batch)); err != nil {
		zap.L().Warn("failed to update scrape status to completed", zap.Error(err))
	}

	zap.L().Info("scraping campaign completed",
		zap.String("scrape_id", scrapeID),
		zap.Int("leads_saved", len(batch)),
	)
}

// SyncLead processa atualizações de leads enviadas pelo Sherlock (push sync).
// Estratégia de lookup em cascata:
//  1. scrape_id + name  (lookup principal — preciso e sem dependência de telefone)
//  2. phone variants    (fallback quando não há scrape_id ou name não casa)
//
// Proteção anti-overwrite: campos vazios no payload não sobrescrevem dados existentes.
func (s *Sherlock) SyncLead(ctx echo.Context) error {
	var req struct {
		ScrapeID string           `json:"scrape_id"`
		Lead     dto.SherlockLead `json:"lead"`
	}
	if err := ctx.Bind(&req); err != nil {
		zap.L().Warn("sync_lead: failed to bind", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "failed to bind request body")
	}

	if req.Lead.Name == "" {
		return utils.HTTPFail(ctx, http.StatusBadRequest, nil, "lead.name is required")
	}

	c := ctx.Request().Context()
	var lead *models.Lead
	var err error

	// Lookup 1: scrape_id + name (lookup principal)
	if req.ScrapeID != "" {
		lead, err = s.leadRepo.FindByScrapeIDAndName(c, req.ScrapeID, req.Lead.Name)
		if err != nil {
			zap.L().Error("sync_lead: lookup by scrape+name failed",
				zap.String("scrape_id", req.ScrapeID),
				zap.String("name", req.Lead.Name),
				zap.Error(err),
			)
			return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "lookup failed")
		}
	}

	// Lookup 2: phone variants (fallback)
	if lead == nil && req.Lead.Phone != "" {
		lead, err = s.leadRepo.FindByPhone(c, "", []string{req.Lead.Phone})
		if err != nil {
			zap.L().Error("sync_lead: lookup by phone failed",
				zap.String("phone", req.Lead.Phone),
				zap.Error(err),
			)
			return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "lookup failed")
		}
	}

	if lead == nil {
		zap.L().Warn("sync_lead: lead not found",
			zap.String("scrape_id", req.ScrapeID),
			zap.String("name", req.Lead.Name),
			zap.String("phone", req.Lead.Phone),
		)
		return utils.HTTPFail(ctx, http.StatusNotFound, nil, "lead not found for synchronization")
	}

	// Impede overwrite: só atualiza campos não-vazios recebidos
	applyIfNotEmpty := func(dest *string, src string) {
		if src != "" {
			*dest = src
		}
	}

	applyIfNotEmpty(&lead.Email, req.Lead.Email)
	applyIfNotEmpty(&lead.Instagram, req.Lead.Instagram)
	applyIfNotEmpty(&lead.Facebook, req.Lead.Facebook)
	applyIfNotEmpty(&lead.LinkedIn, req.Lead.LinkedIn)
	applyIfNotEmpty(&lead.TikTok, req.Lead.TikTok)
	applyIfNotEmpty(&lead.YouTube, req.Lead.YouTube)
	applyIfNotEmpty(&lead.CNPJ, req.Lead.CNPJ)
	applyIfNotEmpty(&lead.Nicho, req.Lead.Nicho)
	applyIfNotEmpty(&lead.TipoTelefone, req.Lead.TipoTelefone)
	applyIfNotEmpty(&lead.LinkWhatsapp, req.Lead.LinkWhatsapp)
	applyIfNotEmpty(&lead.Resumo, req.Lead.Resumo)

	// Booleans: sempre aplica (false é valor legítimo)
	lead.HasPixel = req.Lead.HasPixel
	lead.HasGTM = req.Lead.HasGTM

	// JSON: só substitui se não-nil e não-vazio
	if len(req.Lead.DeepData) > 0 {
		lead.DeepData = req.Lead.DeepData
	}

	// Numéricos: só atualiza se vieram com valor positivo
	if r := parseRating(req.Lead.Rating); r > 0 {
		lead.Rating = r
	}
	if rv := parseReviews(req.Lead.Reviews); rv > 0 {
		lead.Reviews = rv
	}

	lead.EnrichmentStatus = "ENRIQUECIDO"
	lead.UpdatedAt = time.Now()

	if err := s.leadRepo.Update(c, lead); err != nil {
		zap.L().Error("sync_lead: update failed",
			zap.String("lead_id", lead.ID),
			zap.String("name", lead.Name),
			zap.Error(err),
		)
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to update lead")
	}

	zap.L().Info("lead synced successfully",
		zap.String("lead_id", lead.ID),
		zap.String("scrape_id", req.ScrapeID),
		zap.String("name", lead.Name),
	)
	return ctx.JSON(http.StatusOK, map[string]string{"status": "synced"})
}

// ListScrapes retorna todas as campanhas de raspagem da empresa.
func (s *Sherlock) ListScrapes(ctx echo.Context) error {
	companyID, _ := ctx.Get("company_id").(string)

	scrapes, err := s.scrapeRepo.ListByCompanyID(ctx.Request().Context(), companyID)
	if err != nil {
		zap.L().Error("failed to list scrapes", zap.String("company_id", companyID), zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list scraping campaigns")
	}
	if scrapes == nil {
		scrapes = []models.Scrape{}
	}
	return ctx.JSON(http.StatusOK, map[string]interface{}{"scrapes": scrapes})
}

// GetScrape retorna o status de uma campanha específica.
func (s *Sherlock) GetScrape(ctx echo.Context) error {
	companyID, _ := ctx.Get("company_id").(string)
	id := ctx.Param("id")

	if companyID == "" {
		if q := ctx.QueryParam("company_id"); q != "" {
			if role, _ := ctx.Get("user_role").(string); role == "super_admin" {
				companyID = q
			}
		}
	}

	scrape, err := s.scrapeRepo.GetByID(ctx.Request().Context(), id, companyID)
	if err != nil {
		if err == scrapeRepo.ErrNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, nil, "scrape not found")
		}
		zap.L().Error("failed to get scrape", zap.String("id", id), zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to get scraping campaign")
	}
	return ctx.JSON(http.StatusOK, scrape)
}

// DeleteScrape remove uma campanha e seus leads (via CASCADE no banco).
func (s *Sherlock) DeleteScrape(ctx echo.Context) error {
	companyID, _ := ctx.Get("company_id").(string)
	id := ctx.Param("id")

	if companyID == "" {
		if q := ctx.QueryParam("company_id"); q != "" {
			if role, _ := ctx.Get("user_role").(string); role == "super_admin" {
				companyID = q
			}
		}
	}

	if err := s.scrapeRepo.Delete(ctx.Request().Context(), id, companyID); err != nil {
		if err == scrapeRepo.ErrNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, nil, "scrape not found")
		}
		zap.L().Error("failed to delete scrape", zap.String("id", id), zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to delete scraping campaign")
	}
	return ctx.NoContent(http.StatusNoContent)
}

// parseRating converte "4,5" ou "4.5" para float64. Retorna 0 se inválido.
func parseRating(s string) float64 {
	s = strings.TrimSpace(strings.ReplaceAll(s, ",", "."))
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return v
}

// parseReviews converte "1.448" ou "1448" para int. Retorna 0 se inválido.
func parseReviews(s string) int {
	s = strings.TrimSpace(s)
	if s == "" || s == "-" {
		return 0
	}
	s = strings.ReplaceAll(s, ".", "")
	s = strings.ReplaceAll(s, ",", "")
	v, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return v
}
