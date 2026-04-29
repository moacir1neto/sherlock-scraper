package domain

import (
	"time"
)

type Pipeline struct {
	ID        string          `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	UserID    string          `json:"user_id" gorm:"type:uuid;not null"`
	Name      string          `json:"name"`
	Stages    []PipelineStage `json:"stages,omitempty" gorm:"foreignKey:PipelineID"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type PipelineStage struct {
	ID         string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	PipelineID string    `json:"pipeline_id" gorm:"type:uuid;not null;index"`
	Name       string    `json:"name"`
	Order      int       `json:"order"`
	Color      string    `json:"color"`
	CreatedAt  time.Time `json:"created_at"`
}
