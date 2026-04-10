package models

import "time"

// Sector representa um setor de atendimento pertencente a uma empresa.
// Ex.: Geral, Suporte, Financeiro.
type Sector struct {
	ID        string    `json:"id" db:"id"`
	CompanyID string    `json:"company_id" db:"company_id"`
	Name      string    `json:"name" db:"name"`
	Slug      string    `json:"slug,omitempty" db:"slug"`
	IsDefault bool      `json:"is_default" db:"is_default"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

