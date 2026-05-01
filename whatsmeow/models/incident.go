package models

import "time"

type Incident struct {
	ID            string    `json:"id" db:"id"`
	TenantID      *string   `json:"tenant_id,omitempty" db:"tenant_id"`
	CompanyID     *string   `json:"company_id,omitempty" db:"company_id"`
	UserID        *string   `json:"user_id,omitempty" db:"user_id"`
	InstanceID    string    `json:"instance_id,omitempty" db:"instance_id"`
	Code          string    `json:"code" db:"code"`
	Message       string    `json:"message" db:"message"`
	ContextType   string    `json:"context_type,omitempty" db:"context_type"`
	ContextID     string    `json:"context_id,omitempty" db:"context_id"`
	RequestPath   string    `json:"request_path,omitempty" db:"request_path"`
	RequestMethod string    `json:"request_method,omitempty" db:"request_method"`
	PayloadJSON   string    `json:"payload_json,omitempty" db:"payload_json"`
	ErrorDetail   string    `json:"error_detail,omitempty" db:"error_detail"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}
