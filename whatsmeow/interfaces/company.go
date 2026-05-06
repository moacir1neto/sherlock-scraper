package interfaces

import (
	"github.com/verbeux-ai/whatsmiau/models"
	"golang.org/x/net/context"
)

type CompanyRepository interface {
	Create(ctx context.Context, company *models.Company) error
	List(ctx context.Context, id string) ([]models.Company, error)
	GetByID(ctx context.Context, id string) (*models.Company, error)
	Update(ctx context.Context, id string, company *models.Company) (*models.Company, error)
	Delete(ctx context.Context, id string) error
}
