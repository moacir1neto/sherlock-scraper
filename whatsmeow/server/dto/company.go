package dto

type CreateCompanyRequest struct {
	Nome     string  `json:"nome" validate:"required,min=2"`
	CNPJ     string  `json:"cnpj" validate:"required"`
	Email    string  `json:"email" validate:"required,email"`
	Telefone *string `json:"telefone,omitempty"`
	Endereco *string `json:"endereco,omitempty"`
	Ativo    bool    `json:"ativo"`
}

type UpdateCompanyRequest struct {
	Nome     string  `json:"nome" validate:"required,min=2"`
	CNPJ     string  `json:"cnpj" validate:"required"`
	Email    string  `json:"email" validate:"required,email"`
	Telefone *string `json:"telefone,omitempty"`
	Endereco *string `json:"endereco,omitempty"`
	Ativo    bool    `json:"ativo"`
}

type CompanyResponse struct {
	ID        string  `json:"id"`
	Nome      string  `json:"nome"`
	CNPJ      string  `json:"cnpj"`
	Email     string  `json:"email"`
	Telefone  *string `json:"telefone,omitempty"`
	Endereco  *string `json:"endereco,omitempty"`
	Ativo     bool    `json:"ativo"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}
