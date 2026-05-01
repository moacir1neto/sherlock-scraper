package interfaces

import (
	"context"

	"github.com/verbeux-ai/whatsmiau/models"
)

// SectorRepository define operações para gerenciar setores por empresa.
type SectorRepository interface {
	Create(ctx context.Context, sector *models.Sector) error
	Update(ctx context.Context, sector *models.Sector) error
	Delete(ctx context.Context, id, companyID string) error
	GetByID(ctx context.Context, id, companyID string) (*models.Sector, error)
	ListByCompanyID(ctx context.Context, companyID string) ([]models.Sector, error)
	GetDefaultByCompanyID(ctx context.Context, companyID string) (*models.Sector, error)
}
