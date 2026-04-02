package models

import "time"

type Tag struct {
	ID            string    `json:"id" db:"id"`
	CompanyID     string    `json:"company_id" db:"company_id"`
	Name          string    `json:"name" db:"name"`
	Color         string    `json:"color,omitempty" db:"color"`
	KanbanEnabled bool      `json:"kanban_enabled" db:"kanban_enabled"`
	SortOrder     int       `json:"sort_order" db:"sort_order"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

type ChatTag struct {
	ChatID    string    `json:"chat_id" db:"chat_id"`
	TagID     string    `json:"tag_id" db:"tag_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
