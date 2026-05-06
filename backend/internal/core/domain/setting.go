package domain

import "time"

// CompanySetting armazena as configurações globais da empresa
// para injeção dinâmica no prompt de IA.
type CompanySetting struct {
	ID          uint   `gorm:"primaryKey"`
	CompanyName string `gorm:"type:varchar(255);default:'Sherlock Scraper'"`
	Niche       string `gorm:"type:varchar(255);default:'Software House'"`
	MainOffer   string `gorm:"type:text"`
	ToneOfVoice string `gorm:"type:varchar(255);default:'Consultivo e Direto'"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
