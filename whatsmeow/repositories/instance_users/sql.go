package instance_users

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/services"
)

var _ interfaces.InstanceUserRepository = (*SQLInstanceUser)(nil)

type SQLInstanceUser struct {
	db *sql.DB
}

func NewSQL() (*SQLInstanceUser, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLInstanceUser{db: db}, nil
}

func (r *SQLInstanceUser) ListUserIDsByInstanceID(ctx context.Context, instanceID string) ([]string, error) {
	query := `SELECT user_id FROM instance_users WHERE instance_id = $1`
	rows, err := r.db.QueryContext(ctx, query, instanceID)
	if err != nil {
		return nil, fmt.Errorf("list instance users: %w", err)
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func (r *SQLInstanceUser) ListInstanceIDsByUserID(ctx context.Context, userID string) ([]string, error) {
	query := `SELECT instance_id FROM instance_users WHERE user_id = $1`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("list user instances: %w", err)
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func (r *SQLInstanceUser) SetUsersForInstance(ctx context.Context, instanceID string, userIDs []string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `DELETE FROM instance_users WHERE instance_id = $1`, instanceID); err != nil {
		return fmt.Errorf("delete instance users: %w", err)
	}
	for _, uid := range userIDs {
		if uid == "" {
			continue
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO instance_users (instance_id, user_id) VALUES ($1, $2)`, instanceID, uid); err != nil {
			return fmt.Errorf("insert instance user: %w", err)
		}
	}
	return tx.Commit()
}
