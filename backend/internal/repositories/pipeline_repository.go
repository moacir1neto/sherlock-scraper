package repositories

import (
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PipelineRepository struct {
	db *gorm.DB
}

func NewPipelineRepository(db *gorm.DB) *PipelineRepository {
	return &PipelineRepository{db: db}
}

// SavePipeline creates a new pipeline (supports multiple pipelines per user).
func (r *PipelineRepository) SavePipeline(pipeline *domain.Pipeline) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		pipeline.ID = uuid.New().String()
		for i := range pipeline.Stages {
			pipeline.Stages[i].ID = uuid.New().String()
			pipeline.Stages[i].PipelineID = pipeline.ID
		}

		if err := tx.Create(pipeline).Error; err != nil {
			return err
		}

		return nil
	})
}

// GetPipelineByUserID retorna o pipeline mais recente do usuário
func (r *PipelineRepository) GetPipelineByUserID(userID string) (*domain.Pipeline, error) {
	var pipeline domain.Pipeline
	err := r.db.Preload("Stages", func(db *gorm.DB) *gorm.DB {
		return db.Order("pipeline_stages.\"order\" ASC")
	}).Where("user_id = ?", userID).Order("created_at DESC").First(&pipeline).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &pipeline, nil
}

// GetPipelineByID retorna um pipeline específico por ID
func (r *PipelineRepository) GetPipelineByID(pipelineID string) (*domain.Pipeline, error) {
	var pipeline domain.Pipeline
	err := r.db.Preload("Stages", func(db *gorm.DB) *gorm.DB {
		return db.Order("pipeline_stages.\"order\" ASC")
	}).Where("id = ?", pipelineID).First(&pipeline).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &pipeline, nil
}

// GetAllPipelinesByUserID retorna todos os pipelines do usuário com contagem de leads
func (r *PipelineRepository) GetAllPipelinesByUserID(userID string) ([]map[string]interface{}, error) {
	var pipelines []domain.Pipeline
	err := r.db.Preload("Stages", func(db *gorm.DB) *gorm.DB {
		return db.Order("pipeline_stages.\"order\" ASC")
	}).Where("user_id = ?", userID).Order("created_at DESC").Find(&pipelines).Error
	if err != nil {
		return nil, err
	}

	result := make([]map[string]interface{}, 0, len(pipelines))
	for _, p := range pipelines {
		// Collect all stage IDs for this pipeline
		stageIDs := make([]string, 0, len(p.Stages))
		for _, s := range p.Stages {
			stageIDs = append(stageIDs, s.ID)
		}

		var leadCount int64
		if len(stageIDs) > 0 {
			r.db.Model(&domain.Lead{}).Where("kanban_status IN ?", stageIDs).Count(&leadCount)
		}

		result = append(result, map[string]interface{}{
			"id":         p.ID,
			"name":       p.Name,
			"stages":     p.Stages,
			"lead_count": leadCount,
			"created_at": p.CreatedAt,
		})
	}

	return result, nil
}

// DeletePipeline deleta um pipeline específico por ID do pipeline.
// Se pipelineID estiver vazio, deleta o mais recente do usuário (backwards compat).
func (r *PipelineRepository) DeletePipeline(userID string, pipelineID ...string) error {
	var pipeline domain.Pipeline

	if len(pipelineID) > 0 && pipelineID[0] != "" {
		if err := r.db.Where("id = ? AND user_id = ?", pipelineID[0], userID).First(&pipeline).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
	} else {
		if err := r.db.Where("user_id = ?", userID).Order("created_at DESC").First(&pipeline).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
	}

	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("pipeline_id = ?", pipeline.ID).Delete(&domain.PipelineStage{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&pipeline).Error; err != nil {
			return err
		}
		return nil
	})
}

func (r *PipelineRepository) AddStage(pipelineID string, stage *domain.PipelineStage) error {
	var maxOrder int
	// Get the current maximum order for stages in this pipeline
	r.db.Model(&domain.PipelineStage{}).Where("pipeline_id = ?", pipelineID).Select("COALESCE(MAX(\"order\"), 0)").Scan(&maxOrder)

	stage.ID = uuid.New().String()
	stage.PipelineID = pipelineID
	stage.Order = maxOrder + 1

	return r.db.Create(stage).Error
}
