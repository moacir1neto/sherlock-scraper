package domain

import (
	"time"

	"github.com/google/uuid"
)

// ProcessedMessage rastreia mensagens do WhatsApp já processadas pelo Kanban
// para garantir idempotência (at-most-once delivery).
//
// O MessageID é o ID original do WhatsApp (WAMessageID), que é único globalmente.
type ProcessedMessage struct {
	MessageID   string    `gorm:"primaryKey;type:varchar(255)"`
	LeadID      uuid.UUID `gorm:"type:uuid;index"`
	ProcessedAt time.Time `gorm:"autoCreateTime"`
}
