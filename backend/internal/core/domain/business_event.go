package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// BusinessEvent representa um evento de negócio agendado ou ocorrido (ex: reunião, followup).
type BusinessEvent struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	LeadID        uuid.UUID      `gorm:"type:uuid;index;not null" json:"lead_id"`
	CompanyID     uuid.UUID      `gorm:"type:uuid;index;not null" json:"company_id"`
	Type          string         `gorm:"type:varchar(50);not null;index" json:"type"`
	Status        string         `gorm:"type:varchar(20);not null;default:'PENDING';index" json:"status"`
	ScheduledAt   time.Time      `gorm:"index" json:"scheduled_at"`
	AsynqTaskID   string         `gorm:"type:varchar(255)" json:"asynq_task_id,omitempty"`
	Reminders     datatypes.JSON `json:"reminders,omitempty"` // {"24h": "...", "1h": "...", "15m": "..."}
	Payload       datatypes.JSON `json:"payload"`
	ExternalID    string         `gorm:"type:varchar(255);index" json:"external_id,omitempty"`
	ExternalProv  string         `gorm:"type:varchar(50)" json:"external_provider,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	// Relacionamentos
	Lead Lead `gorm:"foreignKey:LeadID" json:"-"`
}

func (b *BusinessEvent) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}
