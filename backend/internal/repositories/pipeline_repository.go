package repositories

import (
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"gorm.io/gorm"
)

type PipelineRepository struct {
	db *gorm.DB
}

func NewPipelineRepository(db *gorm.DB) *PipelineRepository {
	return &PipelineRepository{db: db}
}

// SavePipeline salva um Pipeline e as suas etapas usando Transaction (all or nothing)
func (r *PipelineRepository) SavePipeline(pipeline *domain.Pipeline) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// Tenta criar o pipeline pai primeiro
		if err := tx.Create(pipeline).Error; err != nil {
			return err
		}

		// Garante que o ID do pipeline recém-criado seja repassado para as etapas
		for i := range pipeline.Stages {
			pipeline.Stages[i].PipelineID = pipeline.ID
		}

		// Cria as etapas em lote baseadas na nova struct
		if err := tx.Create(&pipeline.Stages).Error; err != nil {
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
