package models

import "time"

type Chat struct {
	ID                 string     `json:"id" db:"id"`
	InstanceID         string     `json:"instance_id" db:"instance_id"`
	RemoteJID          string     `json:"remote_jid" db:"remote_jid"`
	Name               string     `json:"name" db:"name"`
	LastMessageAt      *time.Time `json:"last_message_at,omitempty" db:"last_message_at"`
	LastMessagePreview string     `json:"last_message_preview,omitempty" db:"last_message_preview"`
	SectorID           *string    `json:"sector_id,omitempty" db:"sector_id"`
	Status             string     `json:"status,omitempty" db:"status"`
	CreatedAt          time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at" db:"updated_at"`
}
