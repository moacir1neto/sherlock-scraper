package models

import "time"

// AISettings armazena o contexto da empresa usado para personalizar
// a análise de IA (Dossiê) gerada pelo Gemini.
type AISettings struct {
	CompanyID   string    `json:"company_id"`
	CompanyName string    `json:"company_name"`
	Nicho       string    `json:"nicho"`
	Oferta      string    `json:"oferta"`
	TomDeVoz    string    `json:"tom_de_voz"`
	UpdatedAt   time.Time `json:"updated_at"`
}
