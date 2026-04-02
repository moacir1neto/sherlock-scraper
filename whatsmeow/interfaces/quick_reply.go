package interfaces

import (
	"context"

	"github.com/verbeux-ai/whatsmiau/models"
)

type QuickReplyRepository interface {
	Create(ctx context.Context, q *models.QuickReply) error
	Update(ctx context.Context, q *models.QuickReply) error
	Delete(ctx context.Context, id, companyID string) error
	GetByID(ctx context.Context, id, companyID string) (*models.QuickReply, error)
	ListByCompanyID(ctx context.Context, companyID string) ([]models.QuickReply, error)
}
