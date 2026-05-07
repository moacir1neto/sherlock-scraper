package models

import "time"

type NotificationTemplate struct {
	ID        string    `json:"id"`
	CompanyID string    `json:"company_id"`
	Type      string    `json:"type"`
	Content   string    `json:"content"`
	Version   int       `json:"version"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
