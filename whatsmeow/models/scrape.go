package models

import "time"

type Scrape struct {
	ID         string    `json:"id" db:"id"`
	CompanyID  string    `json:"company_id" db:"company_id"`
	UserID     string    `json:"user_id" db:"user_id"`
	Keyword    string    `json:"keyword" db:"keyword"`
	Location   string    `json:"location" db:"location"`
	Status     string    `json:"status" db:"status"` // running | completed | error
	TotalLeads int       `json:"total_leads" db:"total_leads"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}
