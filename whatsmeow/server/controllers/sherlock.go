package controllers

import (
	"context"
	"net/http"
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

	if companyID == "" {
		return utils.HTTPFail(ctx, http.StatusForbidden, nil, "company_id required")
	}

	var request dto.ExtractLeadsRequest
	if err := ctx.Bind(&request); err != nil {
		zap.L().Warn("failed to bind request body", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
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
		batch = append(batch, &models.Lead{
			CompanyID:        companyID,
			ScrapeID:         scrapeID,
			SourceID:         "sherlock",
			Name:             l.Name,
			Phone:            l.Phone,
			Address:          l.Address,
			Website:          l.Website,
			Rating:           0,
			Reviews:          0,
			Nicho:            request.Keyword,
			KanbanStatus:     "prospeccao",
			EnrichmentStatus: "CAPTURADO",
			CreatedAt:        now,
		})
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

	if err := s.scrapeRepo.Delete(ctx.Request().Context(), id, companyID); err != nil {
		if err == scrapeRepo.ErrNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, nil, "scrape not found")
		}
		zap.L().Error("failed to delete scrape", zap.String("id", id), zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to delete scraping campaign")
	}
	return ctx.NoContent(http.StatusNoContent)
}
