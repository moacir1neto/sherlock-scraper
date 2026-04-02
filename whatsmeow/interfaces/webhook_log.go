package interfaces

import (
	"github.com/verbeux-ai/whatsmiau/models"
	"golang.org/x/net/context"
)

type WebhookLogRepository interface {
	Create(ctx context.Context, log *models.WebhookLog) error
	List(ctx context.Context, instanceID, companyID, eventType string, limit, offset int) ([]models.WebhookLog, int, error)
	GetByID(ctx context.Context, id string) (*models.WebhookLog, error)
}
