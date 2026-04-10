package dto

type CreateQuickReplyRequest struct {
	Command string `json:"command" validate:"required,max=128"`
	Message string `json:"message" validate:"required"`
}

type UpdateQuickReplyRequest struct {
	ID      string `json:"id" param:"id" validate:"required"`
	Command string `json:"command" validate:"required,max=128"`
	Message string `json:"message" validate:"required"`
}
