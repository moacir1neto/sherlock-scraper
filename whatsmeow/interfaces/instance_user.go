package interfaces

import (
	"context"
)

// InstanceUserRepository define operações para vincular usuários a instâncias (quem pode acessar cada instância).
type InstanceUserRepository interface {
	// ListUserIDsByInstanceID retorna os IDs dos usuários que têm acesso à instância.
	ListUserIDsByInstanceID(ctx context.Context, instanceID string) ([]string, error)
	// ListInstanceIDsByUserID retorna os IDs das instâncias que o usuário pode acessar.
	ListInstanceIDsByUserID(ctx context.Context, userID string) ([]string, error)
	// SetUsersForInstance substitui a lista de user_id para a instância.
	SetUsersForInstance(ctx context.Context, instanceID string, userIDs []string) error
}
