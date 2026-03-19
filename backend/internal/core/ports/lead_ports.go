package ports

import (
	"context"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
)

type LeadRepository interface {
	CreateBatch(ctx context.Context, leads []*domain.Lead) error
	GetAll(ctx context.Context) ([]*domain.Lead, error)
	UpdateStatus(ctx context.Context, id string, status domain.KanbanStatus) error
}

type LeadService interface {
	ImportCSV(ctx context.Context, csvData [][]string) error
	GetLeads(ctx context.Context) ([]*domain.Lead, error)
	ChangeStatus(ctx context.Context, id string, status domain.KanbanStatus) error
}
