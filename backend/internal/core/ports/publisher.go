package ports

import (
	"context"

	"github.com/digitalcombo/sherlock-scraper/backend/pkg/events"
)

// EventPublisher define a interface para disparar notificações e eventos para outros serviços.
// Desacopla a lógica de negócio do transporte real (Redis, Webhook, etc).
type EventPublisher interface {
	PublishNotification(ctx context.Context, companyID string, payload events.EventPayloadV1) error
}
