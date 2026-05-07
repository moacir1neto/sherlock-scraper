package events

import "time"

// EventType define os tipos de eventos de negócio do sistema.
type EventType string

const (
	// TypeMeetingScheduled é disparado quando uma nova reunião é agendada
	TypeMeetingScheduled EventType = "MEETING_SCHEDULED"

	// TaskMeetingReminder é o tipo da tarefa Asynq para lembretes de reunião
	TaskMeetingReminder = "notifications:meeting_reminder"

	TypeMeetingCanceled EventType = "MEETING_CANCELED"
	TypeMeetingReminder EventType = "MEETING_REMINDER"
	TypeFollowupDue     EventType = "FOLLOWUP_DUE"
)

// Intervalos de lembrete
const (
	Reminder24h = 24 * time.Hour
	Reminder1h  = 1 * time.Hour
	Reminder15m = 15 * time.Minute
)

// EventStatus define os possíveis estados de um evento/notificação.
type EventStatus string

const (
	StatusPending   EventStatus = "PENDING"
	StatusSent      EventStatus = "SENT"
	StatusCanceled  EventStatus = "CANCELED"
	StatusFailed    EventStatus = "FAILED"
)

// EventPayloadV1 representa a estrutura de dados versionada para eventos de negócio.
type EventPayloadV1 struct {
	Version     int                    `json:"version"`
	Type        EventType              `json:"type"`
	CompanyID   string                 `json:"company_id"`
	LeadID      string                 `json:"lead_id"`
	LeadName    string                 `json:"lead_name"`
	ScheduledAt string                 `json:"scheduled_at"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// NewEventPayloadV1 cria um novo payload versionado.
func NewEventPayloadV1(eventType EventType, companyID, leadID, leadName, scheduledAt string) EventPayloadV1 {
	return EventPayloadV1{
		Version:     1,
		Type:        eventType,
		CompanyID:   companyID,
		LeadID:      leadID,
		LeadName:    leadName,
		ScheduledAt: scheduledAt,
		Metadata:    make(map[string]interface{}),
	}
}
