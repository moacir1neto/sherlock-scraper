package models

import "time"

type AuditLog struct {
	ID         string    `json:"id" db:"id"`
	CompanyID  *string   `json:"company_id,omitempty" db:"company_id"`
	UserID     *string   `json:"user_id,omitempty" db:"user_id"`
	UserEmail  string    `json:"user_email,omitempty" db:"user_email"`
	Action     string    `json:"action" db:"action"`           // create, update, delete, login
	EntityType string    `json:"entity_type" db:"entity_type"` // user, company, instance, tag, etc.
	EntityID   string    `json:"entity_id,omitempty" db:"entity_id"`
	OldValue   string    `json:"old_value,omitempty" db:"old_value"`
	NewValue   string    `json:"new_value,omitempty" db:"new_value"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}
