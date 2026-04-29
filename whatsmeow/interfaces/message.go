package interfaces

import (
	"errors"
	"time"

	"github.com/verbeux-ai/whatsmiau/models"
	"golang.org/x/net/context"
)

// ErrMessageDuplicate is returned by MessageRepository.Create when the message
// already exists (unique constraint on chat_id + wa_message_id). Callers should
// treat this as a no-op, not as a fatal error.
var ErrMessageDuplicate = errors.New("message already exists")

type MessageRepository interface {
	Create(ctx context.Context, msg *models.Message) error
	UpdateStatus(ctx context.Context, chatID, waMessageID, status string) error
	ListByChatID(ctx context.Context, chatID string, limit int, beforeID string) ([]models.Message, error)
	GetByID(ctx context.Context, id string) (*models.Message, error)
	// CountSentByInstanceIDsBetween conta mensagens enviadas (from_me=true) dos chats das instâncias dadas, entre start (inclusive) e end (exclusive).
	CountSentByInstanceIDsBetween(ctx context.Context, instanceIDs []string, start, end time.Time) (int, error)
}
