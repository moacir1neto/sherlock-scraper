package dto

import "github.com/verbeux-ai/whatsmiau/models"

// SectorWithUsers setor com IDs dos usuários com acesso (para resposta da API).
type SectorWithUsers struct {
	models.Sector
	UserIDs []string `json:"user_ids,omitempty"`
}

type CreateSectorRequest struct {
	Name    string   `json:"name" validate:"required,max=128"`
	Slug    string   `json:"slug,omitempty" validate:"max=128"`
	UserIDs []string `json:"user_ids,omitempty"` // usuários com acesso ao setor
}

type UpdateSectorRequest struct {
	ID      string   `json:"id" param:"id" validate:"required"`
	Name    string   `json:"name" validate:"required,max=128"`
	Slug    string   `json:"slug,omitempty" validate:"max=128"`
	UserIDs []string `json:"user_ids,omitempty"` // usuários com acesso ao setor
}
