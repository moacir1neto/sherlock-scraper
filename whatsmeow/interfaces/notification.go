package interfaces

import (
	"context"
	"github.com/verbeux-ai/whatsmiau/models"
)

type NotificationRepository interface {
	Create(ctx context.Context, n *models.Notification) error
	UpdateStatus(ctx context.Context, id, status string) error
	GetByID(ctx context.Context, id string) (*models.Notification, error)
}
