package models

import "time"

type Company struct {
	ID        string    `json:"id" db:"id"`
	Nome      string    `json:"nome" db:"nome"`
	CNPJ      string    `json:"cnpj" db:"cnpj"`
	Email     string    `json:"email" db:"email"`
	Telefone  *string   `json:"telefone,omitempty" db:"telefone"`
	Endereco  *string   `json:"endereco,omitempty" db:"endereco"`
	Ativo     bool      `json:"ativo" db:"ativo"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

