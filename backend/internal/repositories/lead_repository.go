package repositories

import (
	"context"
	"errors"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
	"gorm.io/gorm"
)

type leadRepository struct {
	db *gorm.DB
}

func NewLeadRepository(db *gorm.DB) ports.LeadRepository {
	return &leadRepository{db: db}
}

func (r *leadRepository) CreateBatch(ctx context.Context, leads []*domain.Lead) error {
	return r.db.WithContext(ctx).Create(&leads).Error
}

func (r *leadRepository) GetAll(ctx context.Context) ([]*domain.Lead, error) {
	var leads []*domain.Lead
	err := r.db.WithContext(ctx).Order("created_at desc").Find(&leads).Error
	return leads, err
}

func (r *leadRepository) UpdateStatus(ctx context.Context, id string, status domain.KanbanStatus) error {
	res := r.db.WithContext(ctx).Model(&domain.Lead{}).Where("id = ?", id).Update("kanban_status", status)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("lead not found")
	}
	return nil
}
