package models

import "time"

type User struct {
	ID        string    `json:"id" db:"id"`
	Nome      string    `json:"nome" db:"nome"`
	Email     string    `json:"email" db:"email"`
	Senha     string    `json:"-" db:"senha"`   // Não serializar senha em JSON
	Role      string    `json:"role" db:"role"` // super_admin, admin, user
	CompanyID *string   `json:"company_id,omitempty" db:"company_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}
