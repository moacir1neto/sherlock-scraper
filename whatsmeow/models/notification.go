package models

import "time"

type Notification struct {
	ID        string    `json:"id"`
	CompanyID string    `json:"company_id"`
	LeadID    string    `json:"lead_id"`
	Type      string    `json:"type"`
	Payload   string    `json:"payload"` // JSON string
	Status    string    `json:"status"`  // pending, sent, delivered, failed
	TraceID   string    `json:"trace_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

const (
	NotificationStatusPending   = "pending"
	NotificationStatusSent      = "sent"
	NotificationStatusDelivered = "delivered"
	NotificationStatusFailed    = "failed"
)
