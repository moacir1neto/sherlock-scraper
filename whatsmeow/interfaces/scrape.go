package interfaces

import (
	"context"

	"github.com/verbeux-ai/whatsmiau/models"
)

type ScrapeRepository interface {
	Create(ctx context.Context, scrape *models.Scrape) error
	GetByID(ctx context.Context, id, companyID string) (*models.Scrape, error)
	ListByCompanyID(ctx context.Context, companyID string) ([]models.Scrape, error)
	UpdateStatus(ctx context.Context, id, status string, totalLeads int) error
	Delete(ctx context.Context, id, companyID string) error
}
