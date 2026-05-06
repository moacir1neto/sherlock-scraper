package dto

import "encoding/json"

type ExtractLeadsRequest struct {
	CompanyID string `json:"company_id"` // Usado apenas por super_admin para especificar a empresa
	Keyword   string `json:"keyword" validate:"required,min=2"`
	Location  string `json:"location" validate:"required,min=2"`
	Limit     int    `json:"limit" validate:"omitempty,min=1,max=100"`
}

type SherlockLead struct {
	Name         string          `json:"name"`
	Phone        string          `json:"phone"`
	Address      string          `json:"address,omitempty"`
	Website      string          `json:"website,omitempty"`
	Rating       string          `json:"rating,omitempty"`
	Reviews      string          `json:"reviews,omitempty"`
	DeepData     json.RawMessage `json:"deep_data,omitempty"`
	Email        string          `json:"email,omitempty"`
	Instagram    string          `json:"instagram,omitempty"`
	Facebook     string          `json:"facebook,omitempty"`
	LinkedIn     string          `json:"linkedin,omitempty"`
	TikTok       string          `json:"tiktok,omitempty"`
	YouTube      string          `json:"youtube,omitempty"`
	Nicho        string          `json:"nicho,omitempty"`
	TipoTelefone string          `json:"tipo_telefone,omitempty"`
	LinkWhatsapp string          `json:"link_whatsapp,omitempty"`
	Resumo       string          `json:"resumo,omitempty"`
	CNPJ         string          `json:"cnpj,omitempty"`
	HasPixel     bool            `json:"has_pixel"`
	HasGTM       bool            `json:"has_gtm"`
}

type ExtractLeadsResponse struct {
	Total int            `json:"total"`
	Leads []SherlockLead `json:"leads"`
}
