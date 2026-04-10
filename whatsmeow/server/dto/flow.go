package dto

import "encoding/json"

type CreateFlowRequest struct {
	Name       string          `json:"name" validate:"required,max=255"`
	Command    string          `json:"command" validate:"required,max=64"`
	Definition json.RawMessage `json:"definition"`
}

type UpdateFlowRequest struct {
	ID         string          `json:"id" param:"id" validate:"required"`
	Name       string          `json:"name" validate:"required,max=255"`
	Command    string          `json:"command" validate:"required,max=64"`
	Definition json.RawMessage `json:"definition"`
}
