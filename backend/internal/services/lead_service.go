package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math/rand/v2"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/queue"
	"github.com/digitalcombo/sherlock-scraper/backend/pkg/csvparser"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
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

const (
	minDelay = 30
	maxDelay = 60
)

func (s *leadService) EnqueueBulkSend(ctx context.Context, leadIDs []string, instanceID string) (int, error) {
	if len(leadIDs) == 0 {
		return 0, errors.New("lead_ids cannot be empty")
	}

	enqueued := 0
	cumulativeDelay := time.Duration(0)

	for i, id := range leadIDs {
		if i > 0 {
			randomSeconds := minDelay + rand.IntN(maxDelay-minDelay+1)
			cumulativeDelay += time.Duration(randomSeconds) * time.Second
		}

		task, err := queue.NewBulkMessageTask(id, instanceID)
		if err != nil {
			log.Printf("⚠️  [BulkSend] Erro ao criar task para lead %s: %v", id, err)
			continue
		}

		info, err := queue.Client.Enqueue(task, asynq.ProcessIn(cumulativeDelay))
		if err != nil {
			log.Printf("⚠️  [BulkSend] Erro ao enfileirar lead %s: %v", id, err)
			continue
		}

		log.Printf("📨 [BulkSend] Lead %s enfileirado | delay=%v | queue=%s | task_id=%s",
			id, cumulativeDelay, info.Queue, info.ID)
		enqueued++
	}

	log.Printf("✅ [BulkSend] %d/%d leads enfileirados | delay total estimado: %v",
		enqueued, len(leadIDs), cumulativeDelay)

	return enqueued, nil
}

func (s *leadService) CreateLead(ctx context.Context, lead *domain.Lead) error {
	return s.repo.Create(ctx, lead)
}

func (s *leadService) GetLead(ctx context.Context, id string) (*domain.Lead, error) {
	return s.repo.GetByID(ctx, id)
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

func (s *leadService) DeleteLead(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
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

// formatDelay returns a human-friendly string for a duration.
func formatDelay(d time.Duration) string {
	return fmt.Sprintf("%.0fs", d.Seconds())
}

