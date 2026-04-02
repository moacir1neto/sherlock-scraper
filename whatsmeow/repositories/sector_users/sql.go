package sector_users

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/services"
)

var _ interfaces.SectorUserRepository = (*SQLSectorUser)(nil)

type SQLSectorUser struct {
	db *sql.DB
}

func NewSQL() (*SQLSectorUser, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLSectorUser{db: db}, nil
}

func (r *SQLSectorUser) ListUserIDsBySectorID(ctx context.Context, sectorID string) ([]string, error) {
	query := `SELECT user_id FROM sector_users WHERE sector_id = $1`
	rows, err := r.db.QueryContext(ctx, query, sectorID)
	if err != nil {
		return nil, fmt.Errorf("list sector users: %w", err)
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

func (r *SQLSectorUser) ListSectorIDsByUserID(ctx context.Context, userID string) ([]string, error) {
	query := `SELECT sector_id FROM sector_users WHERE user_id = $1`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("list user sectors: %w", err)
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

func (r *SQLSectorUser) SetUsersForSector(ctx context.Context, sectorID string, userIDs []string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `DELETE FROM sector_users WHERE sector_id = $1`, sectorID); err != nil {
		return fmt.Errorf("delete sector users: %w", err)
	}
	for _, uid := range userIDs {
		if uid == "" {
			continue
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO sector_users (sector_id, user_id) VALUES ($1, $2)`, sectorID, uid); err != nil {
			return fmt.Errorf("insert sector user: %w", err)
		}
	}
	return tx.Commit()
}
