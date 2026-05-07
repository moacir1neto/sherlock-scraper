package repositories

import (
	"context"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type businessEventRepository struct {
	db *gorm.DB
}

func NewBusinessEventRepository(db *gorm.DB) *businessEventRepository {
	return &businessEventRepository{db: db}
}

func (r *businessEventRepository) Create(ctx context.Context, event *domain.BusinessEvent) error {
	return r.db.WithContext(ctx).Create(event).Error
}

func (r *businessEventRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.BusinessEvent, error) {
	var event domain.BusinessEvent
	err := r.db.WithContext(ctx).First(&event, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &event, nil
}

func (r *businessEventRepository) Update(ctx context.Context, event *domain.BusinessEvent) error {
	return r.db.WithContext(ctx).Save(event).Error
}

func (r *businessEventRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&domain.BusinessEvent{}, "id = ?", id).Error
}

func (r *businessEventRepository) ListByCompany(ctx context.Context, companyID uuid.UUID) ([]domain.BusinessEvent, error) {
	var events []domain.BusinessEvent
	err := r.db.WithContext(ctx).Where("company_id = ?", companyID).Order("scheduled_at desc").Find(&events).Error
	return events, err
}

func (r *businessEventRepository) ListByLead(ctx context.Context, leadID uuid.UUID) ([]domain.BusinessEvent, error) {
	var events []domain.BusinessEvent
	err := r.db.WithContext(ctx).Where("lead_id = ?", leadID).Order("scheduled_at desc").Find(&events).Error
	return events, err
}
