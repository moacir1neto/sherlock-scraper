package models

import (
	"encoding/json"
	"time"
)

type Flow struct {
	ID         string          `json:"id" db:"id"`
	CompanyID  string          `json:"company_id" db:"company_id"`
	Name       string          `json:"name" db:"name"`
	Command    string          `json:"command" db:"command"`
	Definition json.RawMessage `json:"definition" db:"definition"`
	CreatedAt  time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at" db:"updated_at"`
}
