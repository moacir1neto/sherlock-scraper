package dto

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
}

type LoginResponse struct {
	Token string      `json:"token"`
	User  AuthUserResponse `json:"user"`
}

type AuthUserResponse struct {
	ID        string  `json:"id"`
	Nome      string  `json:"nome"`
	Email     string  `json:"email"`
	Role      string  `json:"role"`
	CompanyID *string `json:"company_id,omitempty"`
}

