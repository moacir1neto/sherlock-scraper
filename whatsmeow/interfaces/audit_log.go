package interfaces

import (
	"context"

	"github.com/verbeux-ai/whatsmiau/models"
)

type AuditLogRepository interface {
	Create(ctx context.Context, log *models.AuditLog) error
	List(ctx context.Context, companyID string, limit, offset int) ([]models.AuditLog, int, error)
	GetByID(ctx context.Context, id string) (*models.AuditLog, error)
}
