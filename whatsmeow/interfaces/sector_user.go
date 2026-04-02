package interfaces

import (
	"context"
)

// SectorUserRepository define operações para vincular usuários a setores (quem pode acessar cada setor).
type SectorUserRepository interface {
	// ListUserIDsBySectorID retorna os IDs dos usuários que têm acesso ao setor.
	ListUserIDsBySectorID(ctx context.Context, sectorID string) ([]string, error)
	// ListSectorIDsByUserID retorna os IDs dos setores que o usuário pode acessar.
	ListSectorIDsByUserID(ctx context.Context, userID string) ([]string, error)
	// SetUsersForSector substitui a lista de user_id para o setor.
	SetUsersForSector(ctx context.Context, sectorID string, userIDs []string) error
}
