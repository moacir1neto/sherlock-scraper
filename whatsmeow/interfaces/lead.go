package interfaces

import (
	"context"

	"github.com/verbeux-ai/whatsmiau/models"
)

type LeadRepository interface {
	Create(ctx context.Context, lead *models.Lead) error
	BulkCreate(ctx context.Context, leads []*models.Lead) error
	Update(ctx context.Context, lead *models.Lead) error
	UpdateStatus(ctx context.Context, id, companyID, kanbanStatus string) error
	UpdateAIAnalysis(ctx context.Context, id, companyID, aiAnalysis string) error
	GetByID(ctx context.Context, id, companyID string) (*models.Lead, error)
	ListByCompanyID(ctx context.Context, companyID string, limit, offset int, status string) ([]models.Lead, int, error)
	ListByScrapeID(ctx context.Context, scrapeID, companyID string) ([]models.Lead, error)
	Delete(ctx context.Context, id, companyID string) error
	// FindByPhone busca o lead mais recente cujo telefone (normalizado, só dígitos)
	// corresponda a qualquer uma das variantes fornecidas. Retorna nil sem erro
	// se nenhum lead for encontrado.
	FindByPhone(ctx context.Context, companyID string, variants []string) (*models.Lead, error)
	// FindByName busca o lead mais recente cujo nome contenha a string fornecida
	// (case-insensitive). Usado como fallback quando o telefone não casa.
	// Retorna nil sem erro se nenhum lead for encontrado.
	FindByName(ctx context.Context, companyID string, name string) (*models.Lead, error)
}
