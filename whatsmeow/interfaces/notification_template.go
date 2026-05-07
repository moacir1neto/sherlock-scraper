package interfaces

import (
	"context"
	"github.com/verbeux-ai/whatsmiau/models"
)

type NotificationTemplateRepository interface {
	GetByType(ctx context.Context, companyID, eventType string) (*models.NotificationTemplate, error)
	Upsert(ctx context.Context, t *models.NotificationTemplate) error
}
