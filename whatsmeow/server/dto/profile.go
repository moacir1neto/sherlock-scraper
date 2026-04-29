package dto

type UpdateProfileRequest struct {
	Nome     string  `json:"nome" validate:"required,min=2"`
	Email    string  `json:"email" validate:"required,email"`
	Password *string `json:"password,omitempty" validate:"omitempty,min=6"`
}

