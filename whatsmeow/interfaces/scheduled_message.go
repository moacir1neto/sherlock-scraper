package interfaces

import (
	"context"
	"time"

	"github.com/verbeux-ai/whatsmiau/models"
)

type ScheduledMessageRepository interface {
	Create(ctx context.Context, m *models.ScheduledMessage) error
	ListByCompanyID(ctx context.Context, companyID string) ([]models.ScheduledMessage, error)
	GetByID(ctx context.Context, id, companyID string) (*models.ScheduledMessage, error)
	UpdateStatus(ctx context.Context, id, companyID, status string, sentAt *time.Time, errorMsg string) error
	Delete(ctx context.Context, id, companyID string) error
	ListPendingUntil(ctx context.Context, until time.Time) ([]models.ScheduledMessage, error)
}
