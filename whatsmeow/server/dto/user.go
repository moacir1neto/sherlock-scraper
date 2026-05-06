package dto

type CreateUserRequest struct {
	Nome      string  `json:"nome" validate:"required,min=2"`
	Email     string  `json:"email" validate:"required,email"`
	Password  string  `json:"password" validate:"required,min=6"`
	Role      string  `json:"role" validate:"required,oneof=super_admin admin user"`
	CompanyID *string `json:"company_id,omitempty"`
}

type UpdateUserRequest struct {
	Nome      string  `json:"nome" validate:"required,min=2"`
	Email     string  `json:"email" validate:"required,email"`
	Password  *string `json:"password,omitempty" validate:"omitempty,min=6"`
	Role      string  `json:"role" validate:"required,oneof=super_admin admin user"`
	CompanyID *string `json:"company_id,omitempty"`
}

type UserResponse struct {
	ID        string  `json:"id"`
	Nome      string  `json:"nome"`
	Email     string  `json:"email"`
	Role      string  `json:"role"`
	CompanyID *string `json:"company_id,omitempty"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}
