package models

import "time"

type WebhookLog struct {
	ID             string    `json:"id" db:"id"`
	InstanceID     string    `json:"instance_id" db:"instance_id"`
	CompanyID      *string   `json:"company_id,omitempty" db:"company_id"`
	EventType      string    `json:"event_type" db:"event_type"`
	URL            string    `json:"url" db:"url"`
	RequestBody    string    `json:"request_body,omitempty" db:"request_body"`
	ResponseStatus *int      `json:"response_status,omitempty" db:"response_status"`
	ResponseBody   string    `json:"response_body,omitempty" db:"response_body"`
	ErrorMessage   string    `json:"error_message,omitempty" db:"error_message"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}
