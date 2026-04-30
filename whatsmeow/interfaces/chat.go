package interfaces

import (
	"github.com/verbeux-ai/whatsmiau/models"
	"golang.org/x/net/context"
)

type ChatRepository interface {
	CreateOrUpdate(ctx context.Context, chat *models.Chat) error
	GetByInstanceAndRemoteJID(ctx context.Context, instanceID, remoteJID string) (*models.Chat, error)
	// ListByInstanceID lista chats da instância. allowedSectorIDs: se não nil, filtra por setores (para role=user); nil = sem filtro (admin).
	ListByInstanceID(ctx context.Context, instanceID string, limit int, allowedSectorIDs []string) ([]models.Chat, error)
	GetByID(ctx context.Context, id string) (*models.Chat, error)
	UpdateStatusAndSector(ctx context.Context, id string, status string, sectorID *string) error
	// ResumeAgent zera ai_paused=false para o chat, permitindo que o Super Vendedor volte a responder.
	ResumeAgent(ctx context.Context, chatID string) error
	// PauseAgent seta ai_paused=true, pausando as respostas automáticas do Super Vendedor.
	PauseAgent(ctx context.Context, chatID string) error
	// CountByInstanceIDsGroupByStatus retorna a contagem de chats por status (aguardando, atendendo, finalizado) para as instâncias dadas.
	CountByInstanceIDsGroupByStatus(ctx context.Context, instanceIDs []string) (aguardando, atendendo, finalizado int, err error)
}
