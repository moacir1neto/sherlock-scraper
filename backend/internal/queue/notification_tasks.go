package queue

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/database"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/repositories"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/sse"
	"github.com/digitalcombo/sherlock-scraper/backend/pkg/events"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"go.uber.org/zap"
)

// HandleMeetingReminderTask processa o disparo de um lembrete de reunião vindo do Asynq.
func HandleMeetingReminderTask(ctx context.Context, t *asynq.Task) error {
	var payload events.EventPayloadV1
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal reminder payload: %w", err)
	}

	eventID, ok := payload.Metadata["event_id"].(string)
	if !ok {
		return fmt.Errorf("event_id missing in task metadata")
	}

	// 1. Inicializa repositórios (usa DB global para simplificar no worker)
	repo := repositories.NewBusinessEventRepository(database.DB)
	publisher := sse.NewRedisPublisher()

	// 2. Verifica se o evento ainda é válido
	parsedID, err := uuid.Parse(eventID)
	if err != nil {
		return fmt.Errorf("invalid event_id format: %w", err)
	}

	event, err := repo.GetByID(ctx, parsedID)
	if err != nil {
		zap.L().Warn("skipping reminder: event not found or error", zap.String("event_id", eventID), zap.Error(err))
		return nil 
	}

	if event.Status == string(events.StatusCanceled) {
		zap.L().Info("skipping reminder: event was canceled", zap.String("event_id", eventID))
		return nil
	}

	// 3. Dispara a notificação via SSE/Redis
	err = publisher.PublishNotification(ctx, payload.CompanyID, payload)
	if err != nil {
		return fmt.Errorf("failed to publish reminder notification: %w", err)
	}

	zap.L().Info("reminder notification sent successfully", 
		zap.String("event_id", eventID), 
		zap.String("label", payload.Metadata["reminder_label"].(string)))

	return nil
}
