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

// SavePipeline deleta qualquer pipeline existente do usuário e salva o novo,
// tudo dentro de uma única Transaction (all or nothing).
func (r *PipelineRepository) SavePipeline(pipeline *domain.Pipeline) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. Busca pipeline existente para este user_id
		var existing domain.Pipeline
		err := tx.Where("user_id = ?", pipeline.UserID).First(&existing).Error
		if err == nil {
			// Pipeline encontrado — deletar stages primeiro, depois o pipeline
			if err := tx.Where("pipeline_id = ?", existing.ID).Delete(&domain.PipelineStage{}).Error; err != nil {
				return err
			}
			if err := tx.Delete(&existing).Error; err != nil {
				return err
			}
		} else if err != gorm.ErrRecordNotFound {
			// Erro inesperado na consulta
			return err
		}

		// 2. Gera UUIDs explícitos para o pipeline e cada stage
		pipeline.ID = uuid.New().String()
		for i := range pipeline.Stages {
			pipeline.Stages[i].ID = uuid.New().String()
			pipeline.Stages[i].PipelineID = pipeline.ID
		}

		// 3. Cria o novo pipeline com suas stages (insert único)
		if err := tx.Create(pipeline).Error; err != nil {
			return err
		}

		return nil
	})
}

// GetPipelineByUserID retorna o pipeline (se existir) e já preenche as etapas em ordem
func (r *PipelineRepository) GetPipelineByUserID(userID string) (*domain.Pipeline, error) {
	var pipeline domain.Pipeline
	// Preload the stages and order them by the "order" column
	err := r.db.Preload("Stages", func(db *gorm.DB) *gorm.DB {
		return db.Order("pipeline_stages.order ASC")
	}).Where("user_id = ?", userID).First(&pipeline).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil // Return nil seamlessly if empty
		}
		return nil, err
	}
	return &pipeline, nil
}

// DeletePipeline deleta em cascata as etapas e o pipeline de um usuário específico.
func (r *PipelineRepository) DeletePipeline(userID string) error {
	var pipeline domain.Pipeline
	// Busca o pipeline do usuário primeiro
	if err := r.db.Where("user_id = ?", userID).First(&pipeline).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return err
	}

	return r.db.Transaction(func(tx *gorm.DB) error {
		// Deleta as stages associadas a esse pipeline
		if err := tx.Where("pipeline_id = ?", pipeline.ID).Delete(&domain.PipelineStage{}).Error; err != nil {
			return err
		}

		// Deleta o pipeline
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
