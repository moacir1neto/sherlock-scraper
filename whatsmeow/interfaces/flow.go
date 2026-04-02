package interfaces

import (
	"context"

	"github.com/verbeux-ai/whatsmiau/models"
)

type FlowRepository interface {
	Create(ctx context.Context, f *models.Flow) error
	Update(ctx context.Context, f *models.Flow) error
	Delete(ctx context.Context, id, companyID string) error
	GetByID(ctx context.Context, id, companyID string) (*models.Flow, error)
	ListByCompanyID(ctx context.Context, companyID string) ([]models.Flow, error)
}
