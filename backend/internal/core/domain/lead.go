package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"github.com/digitalcombo/sherlock-scraper/backend/pkg/phoneutil"
)

type KanbanStatus string

const (
	StatusProspeccao      KanbanStatus = "prospeccao"
	StatusContatado       KanbanStatus = "contatado"
	StatusReuniaoAgendada KanbanStatus = "reuniao_agendada"
	StatusNegociacao      KanbanStatus = "negociacao"
	StatusEmConversa      KanbanStatus = "em_conversa" // Mantido por compatibilidade; automação usa StatusContatado
	StatusGanho           KanbanStatus = "ganho"
	StatusPerdido         KanbanStatus = "perdido"
)

type ScrapingStatus string

const (
	ScrapeRunning   ScrapingStatus = "running"
	ScrapeCompleted ScrapingStatus = "completed"
	ScrapeError     ScrapingStatus = "error"
)

type EnrichmentStatus string

const (
	StatusCapturado       EnrichmentStatus = "CAPTURADO"
	StatusEnriquecendo    EnrichmentStatus = "ENRIQUECENDO"
	StatusEnriquecido     EnrichmentStatus = "ENRIQUECIDO"
	StatusEnrichmentFailed EnrichmentStatus = "ENRICHMENT_FAILED"
)

type ScrapingJob struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	Nicho       string         `gorm:"type:varchar(255);not null"`
	Localizacao string         `gorm:"type:varchar(255);not null"`
	Status      ScrapingStatus `gorm:"type:varchar(50);default:'running'"`
	Logs        string         `gorm:"type:text"`
	Leads       []Lead         `gorm:"foreignKey:ScrapingJobID"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type Lead struct {
	ID            uuid.UUID    `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ScrapingJobID *uuid.UUID   `gorm:"type:uuid;index"`
	Empresa       string       `gorm:"type:varchar(255);not null"`
	Nicho         string       `gorm:"type:varchar(255)"`
	Rating        string       `gorm:"type:varchar(50)"`
	QtdAvaliacoes string       `gorm:"type:varchar(50)"`
	ResumoNegocio string       `gorm:"type:text"`
	Endereco      string       `gorm:"type:varchar(500)"`
	Telefone      string       `gorm:"type:varchar(50)"`
	TipoTelefone  string       `gorm:"type:varchar(50)"`
	LinkWhatsapp  string       `gorm:"type:varchar(255)"`
	Site          string       `gorm:"type:varchar(255)"`
	Email         string       `gorm:"type:varchar(255)"`
	Instagram        string           `gorm:"type:varchar(255)"`
	Facebook         string           `gorm:"type:varchar(255)"`
	LinkedIn         string           `gorm:"type:varchar(255)"`
	TikTok           string           `gorm:"type:varchar(255)"`
	YouTube          string           `gorm:"type:varchar(255)"`
	CNPJ             string           `gorm:"type:varchar(20)"`
	TemPixel         bool             `gorm:"default:false"`
	TemGTM           bool             `gorm:"default:false"`
	DeepData         datatypes.JSON   `gorm:"type:jsonb"`
	AIAnalysis       datatypes.JSON   `json:"ai_analysis" gorm:"type:jsonb"`
	Status           EnrichmentStatus `gorm:"type:varchar(50);default:'CAPTURADO'"`
	KanbanStatus     KanbanStatus     `gorm:"type:varchar(50);default:'prospeccao'"`
	NotasProspeccao  string           `gorm:"type:text"`
	EstimatedValue   float64          `json:"estimated_value" gorm:"type:decimal(12,2);default:0"`
	DueDate          *time.Time       `json:"due_date" gorm:"type:date"`
	Tags             string           `json:"tags" gorm:"type:varchar(500)"`
	LinkedLeadID     *uuid.UUID       `json:"linked_lead_id" gorm:"type:uuid"`
	DossierData      datatypes.JSON   `json:"dossier_data" gorm:"type:jsonb"`
	DossierAnalysis  string           `json:"dossier_analysis" gorm:"type:text"`
	Score            int              `json:"score" gorm:"default:0"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// LeadDossier armazena o resultado gerado pelo pipeline dossier:analyze.
// Tabela separada para não poluir Lead e permitir cache imutável.
type LeadDossier struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	LeadID    uuid.UUID `gorm:"type:uuid;not null;index"`
	Content   string    `gorm:"type:text;not null"`
	CreatedAt time.Time
}

func (l *Lead) BeforeCreate(tx *gorm.DB) (err error) {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	if l.KanbanStatus == "" {
		l.KanbanStatus = StatusProspeccao
	}
	if l.Status == "" {
		l.Status = StatusCapturado
	}
	return
}

func (l *Lead) BeforeSave(tx *gorm.DB) (err error) {
	if l.Telefone == "" {
		return
	}

	normalized, normErr := phoneutil.NormalizeForWhatsApp(l.Telefone)
	if normErr != nil {
		// Número inválido: persiste vazio para evitar envios com JID corrompido.
		l.Telefone = ""
		l.LinkWhatsapp = ""
		return
	}

	l.Telefone = normalized
	l.LinkWhatsapp = "https://wa.me/" + normalized
	return
}
