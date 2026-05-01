package repositories

import (
	"context"
	"errors"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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

func (r *leadRepository) GetByID(ctx context.Context, id string) (*domain.Lead, error) {
	var lead domain.Lead
	err := r.db.WithContext(ctx).First(&lead, "id = ?", id).Error
	return &lead, err
}

func (r *leadRepository) GetByJobID(ctx context.Context, jobID string) ([]*domain.Lead, error) {
	var leads []*domain.Lead
	err := r.db.WithContext(ctx).Where("scraping_job_id = ?", jobID).Order("created_at desc").Find(&leads).Error
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

func (r *leadRepository) Update(ctx context.Context, lead *domain.Lead) error {
	return r.db.WithContext(ctx).Save(lead).Error
}

func (r *leadRepository) Create(ctx context.Context, lead *domain.Lead) error {
	return r.db.WithContext(ctx).Create(lead).Error
}

func (r *leadRepository) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.Lead{}, "id = ?", id).Error
}

func (r *leadRepository) CreateScrapeJob(ctx context.Context, job *domain.ScrapingJob) error {
	return r.db.WithContext(ctx).Create(job).Error
}

func (r *leadRepository) UpdateScrapeJob(ctx context.Context, job *domain.ScrapingJob) error {
	return r.db.WithContext(ctx).Save(job).Error
}

func (r *leadRepository) GetScrapeJob(ctx context.Context, id string) (*domain.ScrapingJob, error) {
	var job domain.ScrapingJob
	err := r.db.WithContext(ctx).First(&job, "id = ?", id).Error
	return &job, err
}

func (r *leadRepository) ListScrapeJobs(ctx context.Context) ([]*domain.ScrapingJob, error) {
	var jobs []*domain.ScrapingJob
	err := r.db.WithContext(ctx).Order("created_at desc").Find(&jobs).Error
	return jobs, err
}

func (r *leadRepository) FindByPhone(ctx context.Context, variants []string) (*domain.Lead, error) {
	if len(variants) == 0 {
		return nil, errors.New("phoneutil: no variants provided to FindByPhone")
	}

	var leads []*domain.Lead

	err := r.db.WithContext(ctx).
		Where("regexp_replace(telefone, '[^0-9]', '', 'g') IN ?", variants).
		Order("created_at DESC").
		Limit(1).
		Find(&leads).Error

	if err != nil {
		return nil, err
	}

	if len(leads) == 0 {
		return nil, nil
	}

	return leads[0], nil
}

func (r *leadRepository) UpdateStatusConditional(
	ctx context.Context,
	id string,
	newStatus domain.KanbanStatus,
	blockedStatuses []domain.KanbanStatus,
) (bool, error) {
	// Converte []KanbanStatus → []string para o IN clause do GORM
	blocked := make([]string, len(blockedStatuses))
	for i, s := range blockedStatuses {
		blocked[i] = string(s)
	}

	res := r.db.WithContext(ctx).
		Model(&domain.Lead{}).
		Where("id = ? AND kanban_status NOT IN ?", id, blocked).
		Updates(map[string]interface{}{
			"kanban_status": string(newStatus),
			"updated_at":    time.Now(),
		})

	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected > 0, nil
}

// UpdateStatusIdempotent implementa a lógica de idempotência via Transação + OnConflict.
func (r *leadRepository) UpdateStatusIdempotent(
	ctx context.Context,
	messageID string,
	id string,
	newStatus domain.KanbanStatus,
	blockedStatuses []domain.KanbanStatus,
) (bool, error) {
	var updated bool
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {

		res := tx.Clauses(clause.OnConflict{
			DoNothing: true,
		}).Create(&domain.ProcessedMessage{
			MessageID:   messageID,
			LeadID:      uuid.MustParse(id),
			ProcessedAt: time.Now(),
		})

		if res.RowsAffected == 0 {
			updated = false
			return nil
		}

		blocked := make([]string, len(blockedStatuses))
		for i, s := range blockedStatuses {
			blocked[i] = string(s)
		}

		resUpdate := tx.Model(&domain.Lead{}).
			Where("id = ? AND kanban_status NOT IN ?", id, blocked).
			Updates(map[string]interface{}{
				"kanban_status": string(newStatus),
				"updated_at":    time.Now(),
			})

		if resUpdate.Error != nil {
			return resUpdate.Error
		}

		updated = resUpdate.RowsAffected > 0
		return nil
	})

	return updated, err
}

func (r *leadRepository) CountPendingEnrichment(ctx context.Context, jobID string) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&domain.Lead{}).
		Where("scraping_job_id = ? AND status NOT IN ?", jobID,
			[]string{string(domain.StatusEnriquecido), string(domain.StatusEnrichmentFailed)}).
		Count(&count).Error
	return count, err
}

func (r *leadRepository) DeleteScrapeJob(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Delete leads first
		if err := tx.Where("scraping_job_id = ?", id).Delete(&domain.Lead{}).Error; err != nil {
			return err
		}
		// Delete scraping job
		if err := tx.Where("id = ?", id).Delete(&domain.ScrapingJob{}).Error; err != nil {
			return err
		}
		return nil
	})
}
