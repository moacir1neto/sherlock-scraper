package services

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/queue"
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

	// Salva os leads no banco de dados
	if err := s.repo.CreateBatch(ctx, leads); err != nil {
		return err
	}

	// Enfileira cada lead para enriquecimento
	for _, lead := range leads {
		task, err := queue.NewEnrichLeadTask(lead.ID.String(), lead.Empresa)
		if err != nil {
			log.Printf("⚠️  Erro ao criar tarefa para lead %s: %v", lead.Empresa, err)
			continue
		}

		if _, err := queue.Client.Enqueue(task); err != nil {
			log.Printf("⚠️  Erro ao enfileirar lead %s: %v", lead.Empresa, err)
			continue
		}

		log.Printf("✅ Lead '%s' (ID: %s) enviado para fila de enriquecimento", lead.Empresa, lead.ID.String())
	}

	return nil
}

func (s *leadService) CreateLead(ctx context.Context, lead *domain.Lead) error {
	return s.repo.Create(ctx, lead)
}

func (s *leadService) GetLeadsByJob(ctx context.Context, jobID string) ([]*domain.Lead, error) {
	return s.repo.GetByJobID(ctx, jobID)
}

func (s *leadService) GetLeads(ctx context.Context) ([]*domain.Lead, error) {
	return s.repo.GetAll(ctx)
}

func (s *leadService) ChangeStatus(ctx context.Context, id string, status domain.KanbanStatus) error {
	// Relaxing validation to support dynamic stages (UUIDs or names from Pipeline)
	return s.repo.UpdateStatus(ctx, id, status)
}

func (s *leadService) UpdateLead(ctx context.Context, lead *domain.Lead) error {
	return s.repo.Update(ctx, lead)
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

func (s *leadService) DeleteJob(ctx context.Context, id string) error {
	return s.repo.DeleteScrapeJob(ctx, id)
}
