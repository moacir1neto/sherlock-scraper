package models

import "time"

type Lead struct {
	ID               string    `json:"id" db:"id"`
	CompanyID        string    `json:"company_id" db:"company_id"`
	ScrapeID         string    `json:"scrape_id" db:"scrape_id"`
	SourceID         string    `json:"source_id" db:"source_id"`
	Name             string    `json:"name" db:"name"`
	Phone            string    `json:"phone" db:"phone"`
	Address          string    `json:"address" db:"address"`
	Website          string    `json:"website" db:"website"`
	Email            string    `json:"email" db:"email"`
	Rating           float64   `json:"rating" db:"rating"`
	Reviews          int       `json:"reviews" db:"reviews"`
	KanbanStatus     string    `json:"kanban_status" db:"kanban_status"`
	EnrichmentStatus string    `json:"enrichment_status" db:"enrichment_status"`
	Notes            string    `json:"notes" db:"notes"`
	EstimatedValue   float64   `json:"estimated_value" db:"estimated_value"`
	Tags             string    `json:"tags" db:"tags"`
	// Campos extras do Sherlock
	Nicho        string `json:"nicho" db:"nicho"`
	Resumo       string `json:"resumo" db:"resumo"`
	TipoTelefone string `json:"tipo_telefone" db:"tipo_telefone"`
	LinkWhatsapp string `json:"link_whatsapp" db:"link_whatsapp"`
	Instagram    string `json:"instagram" db:"instagram"`
	Facebook     string `json:"facebook" db:"facebook"`
	LinkedIn     string `json:"linkedin" db:"linkedin"`
	TikTok       string `json:"tiktok" db:"tiktok"`
	YouTube      string `json:"youtube" db:"youtube"`
	CNPJ         string `json:"cnpj" db:"cnpj"`
	AIAnalysis   string `json:"ai_analysis" db:"ai_analysis"` // JSON string do dossiê IA
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}
