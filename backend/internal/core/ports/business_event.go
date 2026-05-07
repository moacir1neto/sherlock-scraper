package ports

import (
	"context"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/google/uuid"
)

// BusinessEventRepository define as operações de persistência para eventos de negócio.
type BusinessEventRepository interface {
	Create(ctx context.Context, event *domain.BusinessEvent) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.BusinessEvent, error)
	Update(ctx context.Context, event *domain.BusinessEvent) error
	Delete(ctx context.Context, id uuid.UUID) error
	ListByCompany(ctx context.Context, companyID uuid.UUID) ([]domain.BusinessEvent, error)
	ListByLead(ctx context.Context, leadID uuid.UUID) ([]domain.BusinessEvent, error)
}
