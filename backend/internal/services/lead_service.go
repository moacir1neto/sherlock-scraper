package services

import (
	"context"
	"errors"

	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
	"github.com/digitalcombo/sherlock-scraper/backend/pkg/csvparser"
	"github.com/google/uuid"
)

type leadService struct {
	repo ports.LeadRepository
}

func NewLeadService(repo ports.LeadRepository) ports.LeadService {
	return &leadService{repo: repo}
}

func (s *leadService) ImportCSV(ctx context.Context, csvData [][]string, nicho string, jobID *string) error {
	leads := csvparser.MapToLeads(csvData, nicho)
	if len(leads) == 0 {
		return errors.New("no valid leads found in CSV")
	}

	if jobID != nil {
		parsedJobID, err := uuid.Parse(*jobID)
		if err == nil {
			for _, l := range leads {
				l.ScrapingJobID = &parsedJobID
			}
		}
	}

	return s.repo.CreateBatch(ctx, leads)
}

func (s *leadService) GetLeadsByJob(ctx context.Context, jobID string) ([]*domain.Lead, error) {
	return s.repo.GetByJobID(ctx, jobID)
}

func (s *leadService) GetLeads(ctx context.Context) ([]*domain.Lead, error) {
	return s.repo.GetAll(ctx)
}

func (s *leadService) ChangeStatus(ctx context.Context, id string, status domain.KanbanStatus) error {
	switch status {
	case domain.StatusProspeccao, domain.StatusContatado, domain.StatusReuniaoAgendada, domain.StatusNegociacao, domain.StatusGanho, domain.StatusPerdido:
		return s.repo.UpdateStatus(ctx, id, status)
	default:
		return errors.New("invalid kanban status")
	}
}

func (s *leadService) CreateJob(ctx context.Context, nicho, localizacao string) (*domain.ScrapingJob, error) {
	job := &domain.ScrapingJob{
		Nicho:       nicho,
		Localizacao: localizacao,
		Status:      domain.ScrapeRunning,
		CreatedAt:   time.Now(),
	}
	err := s.repo.CreateScrapeJob(ctx, job)
	return job, err
}

func (s *leadService) UpdateJob(ctx context.Context, job *domain.ScrapingJob) error {
	return s.repo.UpdateScrapeJob(ctx, job)
}

func (s *leadService) GetJob(ctx context.Context, id string) (*domain.ScrapingJob, error) {
	return s.repo.GetScrapeJob(ctx, id)
}

func (s *leadService) ListJobs(ctx context.Context) ([]*domain.ScrapingJob, error) {
	return s.repo.ListScrapeJobs(ctx)
}
