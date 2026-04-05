package ports

import (
	"context"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
)

type LeadRepository interface {
	CreateBatch(ctx context.Context, leads []*domain.Lead) error
	GetAll(ctx context.Context) ([]*domain.Lead, error)
	GetByID(ctx context.Context, id string) (*domain.Lead, error)
	GetByJobID(ctx context.Context, jobID string) ([]*domain.Lead, error)
	UpdateStatus(ctx context.Context, id string, status domain.KanbanStatus) error
	// UpdateStatusConditional atualiza kanban_status apenas se o status atual NÃO estiver
	// na lista blockedStatuses. Retorna (true, nil) se a linha foi atualizada,
	// (false, nil) se o status era final e nenhuma linha foi tocada.
	// A lógica é executada atomicamente em uma única query SQL (sem race condition).
	UpdateStatusConditional(ctx context.Context, id string, newStatus domain.KanbanStatus, blockedStatuses []domain.KanbanStatus) (updated bool, err error)
	// FindByPhone busca o lead mais recente cujo campo Telefone, após remover
	// caracteres não-numéricos, bate com qualquer string da lista variants.
	// Retorna (nil, nil) se nenhum lead for encontrado (não é erro).
	FindByPhone(ctx context.Context, variants []string) (*domain.Lead, error)
	Update(ctx context.Context, lead *domain.Lead) error
	Create(ctx context.Context, lead *domain.Lead) error
	Delete(ctx context.Context, id string) error

	CreateScrapeJob(ctx context.Context, job *domain.ScrapingJob) error
	UpdateScrapeJob(ctx context.Context, job *domain.ScrapingJob) error
	GetScrapeJob(ctx context.Context, id string) (*domain.ScrapingJob, error)
	ListScrapeJobs(ctx context.Context) ([]*domain.ScrapingJob, error)
	DeleteScrapeJob(ctx context.Context, id string) error
}

type LeadService interface {
	ImportCSV(ctx context.Context, csvData [][]string, nicho string, jobID *string) error
	CreateLead(ctx context.Context, lead *domain.Lead) error
	GetLead(ctx context.Context, id string) (*domain.Lead, error)
	GetLeads(ctx context.Context) ([]*domain.Lead, error)
	GetLeadsByJob(ctx context.Context, jobID string) ([]*domain.Lead, error)
	ChangeStatus(ctx context.Context, id string, status domain.KanbanStatus) error
	UpdateLead(ctx context.Context, lead *domain.Lead) error
	DeleteLead(ctx context.Context, id string) error

	CreateJob(ctx context.Context, nicho, localizacao string) (*domain.ScrapingJob, error)
	UpdateJob(ctx context.Context, job *domain.ScrapingJob) error
	GetJob(ctx context.Context, id string) (*domain.ScrapingJob, error)
	ListJobs(ctx context.Context) ([]*domain.ScrapingJob, error)
	DeleteJob(ctx context.Context, id string) error
}
