package repositories

import (
	"context"
	"errors"
	"time"

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

// FindByPhone busca o lead mais recentemente criado cujo telefone, após
// normalização (remoção de não-dígitos via regexp_replace no PostgreSQL),
// corresponda a qualquer valor da lista variants.
//
// Retorna (nil, nil) quando nenhum lead é encontrado — o caller deve tratar
// isso como "lead desconhecido", e não como erro.
//
// A normalização é feita pelo banco para evitar que registros antigos com
// formatos inconsistentes sejam ignorados.
func (r *leadRepository) FindByPhone(ctx context.Context, variants []string) (*domain.Lead, error) {
	if len(variants) == 0 {
		return nil, errors.New("phoneutil: no variants provided to FindByPhone")
	}

	var lead domain.Lead
	// regexp_replace(telefone, '[^0-9]', '', 'g') normaliza o telefone no banco
	// IN ? é expandido pelo GORM para IN ($1, $2, ...) com os valores corretos
	err := r.db.WithContext(ctx).
		Where("regexp_replace(telefone, '[^0-9]', '', 'g') IN ?", variants).
		Order("created_at DESC").
		First(&lead).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // não encontrado não é erro de sistema
		}
		return nil, err
	}
	return &lead, nil
}

// UpdateStatusConditional atualiza kanban_status para newStatus somente se o
// status atual NÃO estiver na lista blockedStatuses.
//
// A operação é executada em uma única query UPDATE com a cláusula
// "AND kanban_status NOT IN (?)" — garantindo atomicidade sem race condition
// mesmo com múltiplas instâncias do servidor rodando em paralelo.
//
// Retorna:
//   - (true, nil)  → linha atualizada com sucesso
//   - (false, nil) → nenhuma linha afetada (lead inexistente ou status final)
//   - (false, err) → erro de banco de dados
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
