package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type KanbanStatus string

const (
	StatusProspeccao     KanbanStatus = "prospeccao"
	StatusContatado      KanbanStatus = "contatado"
	StatusReuniaoAgendada KanbanStatus = "reuniao_agendada"
	StatusNegociacao     KanbanStatus = "negociacao"
	StatusGanho          KanbanStatus = "ganho"
	StatusPerdido        KanbanStatus = "perdido"
)

type Lead struct {
	ID            uuid.UUID    `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Empresa       string       `gorm:"type:varchar(255);not null"`
	Nicho         string       `gorm:"type:varchar(255)"`
	Nota          string       `gorm:"type:varchar(50)"`
	QtdAvaliacoes string       `gorm:"type:varchar(50)"`
	ResumoNegocio string       `gorm:"type:text"`
	Endereco      string       `gorm:"type:varchar(500)"`
	Telefone      string       `gorm:"type:varchar(50)"`
	TipoTelefone  string       `gorm:"type:varchar(50)"`
	LinkWhatsapp  string       `gorm:"type:varchar(255)"`
	Site          string       `gorm:"type:varchar(255)"`
	Email         string       `gorm:"type:varchar(255)"`
	Instagram     string       `gorm:"type:varchar(255)"`
	Facebook      string       `gorm:"type:varchar(255)"`
	LinkedIn      string       `gorm:"type:varchar(255)"`
	TikTok        string       `gorm:"type:varchar(255)"`
	YouTube       string       `gorm:"type:varchar(255)"`
	KanbanStatus  KanbanStatus `gorm:"type:varchar(50);default:'prospeccao'"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func (l *Lead) BeforeCreate(tx *gorm.DB) (err error) {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	if l.KanbanStatus == "" {
		l.KanbanStatus = StatusProspeccao
	}
	return
}
