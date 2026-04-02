package services

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/verbeux-ai/whatsmiau/models"
	"golang.org/x/net/context"
)

// RecordIncidentCallback é chamado para persistir o incidente (registrado em routes para evitar import cycle).
type RecordIncidentCallback func(ctx context.Context, inc *models.Incident)

var recordIncidentCallback RecordIncidentCallback

// RegisterIncidentRecorder registra o callback de persistência. Deve ser chamado na inicialização (ex.: routes).
func RegisterIncidentRecorder(fn RecordIncidentCallback) {
	recordIncidentCallback = fn
}

// RecordIncident registra um incidente para monitoramento/suporte. Pode ser chamado de qualquer lugar (ex.: controller de mensagem em erro).
// tenantID, companyID, userID podem ser vazios; payload pode ser nil.
func RecordIncident(ctx context.Context, code, message string, opts *RecordIncidentOpts) {
	if recordIncidentCallback == nil {
		return
	}
	inc := &models.Incident{
		ID:        uuid.New().String(),
		Code:      code,
		Message:   message,
		CreatedAt: time.Now(),
	}
	if opts != nil {
		if opts.TenantID != "" {
			inc.TenantID = &opts.TenantID
		}
		if opts.CompanyID != "" {
			inc.CompanyID = &opts.CompanyID
		}
		if opts.UserID != "" {
			inc.UserID = &opts.UserID
		}
		inc.InstanceID = opts.InstanceID
		inc.ContextType = opts.ContextType
		inc.ContextID = opts.ContextID
		inc.RequestPath = opts.RequestPath
		inc.RequestMethod = opts.RequestMethod
		inc.ErrorDetail = opts.ErrorDetail
		if opts.Payload != nil {
			b, _ := json.Marshal(opts.Payload)
			inc.PayloadJSON = string(b)
		}
	}
	recordIncidentCallback(ctx, inc)
}

type RecordIncidentOpts struct {
	TenantID      string
	CompanyID     string
	UserID        string
	InstanceID    string
	ContextType   string
	ContextID     string
	RequestPath   string
	RequestMethod string
	Payload       interface{}
	ErrorDetail   string
}
