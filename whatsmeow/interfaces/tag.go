package interfaces

import (
	"context"

	"github.com/verbeux-ai/whatsmiau/models"
)

type TagRepository interface {
	Create(ctx context.Context, tag *models.Tag) error
	Update(ctx context.Context, tag *models.Tag) error
	Delete(ctx context.Context, id, companyID string) error
	GetByID(ctx context.Context, id, companyID string) (*models.Tag, error)
	ListByCompanyID(ctx context.Context, companyID string) ([]models.Tag, error)
	CountUsage(ctx context.Context, tagID, companyID string) (int, error)
}

type ChatTagRepository interface {
	Add(ctx context.Context, chatID, tagID string) error
	Remove(ctx context.Context, chatID, tagID string) error
	ListByChatID(ctx context.Context, chatID string) ([]models.Tag, error)
	ListChatIDsByTagID(ctx context.Context, tagID string) ([]string, error)
}
