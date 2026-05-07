package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
	"github.com/digitalcombo/sherlock-scraper/backend/pkg/events"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type EventService struct {
	repo      ports.BusinessEventRepository
	publisher ports.EventPublisher
	scheduler ports.Scheduler
}

func NewEventService(repo ports.BusinessEventRepository, publisher ports.EventPublisher, scheduler ports.Scheduler) *EventService {
	return &EventService{
		repo:      repo,
		publisher: publisher,
		scheduler: scheduler,
	}
}

// CreateMeetingScheduled cria um evento de reunião agendada e dispara a notificação via SSE.
func (s *EventService) CreateMeetingScheduled(ctx context.Context, companyID, leadID uuid.UUID, leadName string, scheduledAt time.Time, metadata map[string]interface{}) (*domain.BusinessEvent, error) {
	// 1. Centraliza a criação do payload versionado
	payload := events.NewEventPayloadV1(events.TypeMeetingScheduled, companyID.String(), leadID.String(), leadName, scheduledAt.Format(time.RFC3339))
	for k, v := range metadata {
		payload.Metadata[k] = v
	}

	payloadJSON, _ := json.Marshal(payload)

	// 2. Persiste no banco de dados
	event := &domain.BusinessEvent{
		CompanyID:   companyID,
		LeadID:      leadID,
		Type:        string(events.TypeMeetingScheduled),
		Status:      string(events.StatusPending),
		ScheduledAt: scheduledAt,
		Payload:     datatypes.JSON(payloadJSON),
	}

	if err := s.repo.Create(ctx, event); err != nil {
		return nil, fmt.Errorf("failed to create event in db: %w", err)
	}

	// 3. Agenda lembretes temporizados via Asynq (Onda 3)
	s.scheduleMeetingReminders(ctx, event, leadName)

	// 4. Dispara notificação realtime via SSE (Onda 2 MVP)
	_ = s.publisher.PublishNotification(ctx, companyID.String(), payload)

	return event, nil
}

// CancelMeeting cancela uma reunião e remove todos os lembretes agendados do Asynq.
func (s *EventService) CancelMeeting(ctx context.Context, eventID string) error {
	// 1. Busca o evento
	parsedID, err := uuid.Parse(eventID)
	if err != nil {
		return fmt.Errorf("invalid event_id format: %w", err)
	}

	event, err := s.repo.GetByID(ctx, parsedID)
	if err != nil {
		return fmt.Errorf("event not found: %w", err)
	}

	// 2. Cancela as tarefas no Asynq
	if event.Reminders != nil {
		var taskIDs map[string]string
		if err := json.Unmarshal(event.Reminders, &taskIDs); err == nil {
			for _, taskID := range taskIDs {
				_ = s.scheduler.Cancel(ctx, taskID)
			}
		}
	}

	// 3. Atualiza status no banco
	event.Status = string(events.StatusCanceled)
	if err := s.repo.Update(ctx, event); err != nil {
		return fmt.Errorf("failed to update event status: %w", err)
	}

	// 4. Notifica o cancelamento realtime (opcional, mas bom para UI)
	payload := events.NewEventPayloadV1(events.TypeMeetingCanceled, event.CompanyID.String(), event.LeadID.String(), "-", event.ScheduledAt.Format(time.RFC3339))
	payload.Metadata["event_id"] = event.ID.String()
	_ = s.publisher.PublishNotification(ctx, event.CompanyID.String(), payload)

	return nil
}

// scheduleMeetingReminders agenda as tarefas de lembrete (24h, 1h, 15min).
func (s *EventService) scheduleMeetingReminders(ctx context.Context, event *domain.BusinessEvent, leadName string) {
	reminderTimes := map[string]time.Duration{
		"24h": events.Reminder24h,
		"1h":  events.Reminder1h,
		"15m": events.Reminder15m,
	}

	taskIDs := make(map[string]string)
	now := time.Now()

	for label, offset := range reminderTimes {
		processAt := event.ScheduledAt.Add(-offset)
		
		// Só agenda se o horário do lembrete ainda não passou
		if processAt.After(now) {
			payload := events.NewEventPayloadV1(events.TypeMeetingReminder, event.CompanyID.String(), event.LeadID.String(), leadName, event.ScheduledAt.Format(time.RFC3339))
			payload.Metadata["reminder_label"] = label
			payload.Metadata["event_id"] = event.ID.String()

			taskID, err := s.scheduler.Schedule(ctx, events.TaskMeetingReminder, payload, processAt)
			if err == nil {
				taskIDs[label] = taskID
			}
		}
	}

	// Atualiza o evento com os IDs das tarefas para possibilitar cancelamento
	if len(taskIDs) > 0 {
		idsJSON, _ := json.Marshal(taskIDs)
		event.Reminders = datatypes.JSON(idsJSON)
		_ = s.repo.Update(ctx, event)
	}
}

// ListEventsByLead retorna todos os eventos de negócio de um lead específico.
func (s *EventService) ListEventsByLead(ctx context.Context, leadID uuid.UUID) ([]domain.BusinessEvent, error) {
	return s.repo.ListByLead(ctx, leadID)
}
