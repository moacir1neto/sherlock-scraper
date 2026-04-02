package chats

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/services"
	"golang.org/x/net/context"
)

var _ interfaces.ChatRepository = (*SQLChat)(nil)

var ErrNotFound = errors.New("chat not found")

type SQLChat struct {
	db *sql.DB
}

func NewSQL() (*SQLChat, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLChat{db: db}, nil
}

func (r *SQLChat) CreateOrUpdate(ctx context.Context, chat *models.Chat) error {
	existing, err := r.GetByInstanceAndRemoteJID(ctx, chat.InstanceID, chat.RemoteJID)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return err
	}
	now := time.Now()
	if existing != nil {
		chat.ID = existing.ID
		chat.CreatedAt = existing.CreatedAt
		chat.UpdatedAt = now
		statusToWrite := chat.Status
		if statusToWrite == "" {
			if existing.Status == "finalizado" {
				statusToWrite = "aguardando"
			} else {
				statusToWrite = existing.Status
			}
		}
		if statusToWrite == "" {
			statusToWrite = "aguardando"
		}
		query := `UPDATE chats SET name = $1, last_message_at = $2, last_message_preview = $3, sector_id = $4, status = $5, updated_at = $6 WHERE id = $7`
		_, err = r.db.ExecContext(ctx, query,
			chat.Name, chat.LastMessageAt, truncatePreview(chat.LastMessagePreview), chat.SectorID, statusToWrite, chat.UpdatedAt, chat.ID)
		return err
	}
	if chat.Status == "" {
		chat.Status = "aguardando"
	}
	chat.ID = uuid.New().String()
	chat.CreatedAt = now
	chat.UpdatedAt = now
	query := `INSERT INTO chats (id, instance_id, remote_jid, name, last_message_at, last_message_preview, sector_id, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
	_, err = r.db.ExecContext(ctx, query,
		chat.ID, chat.InstanceID, chat.RemoteJID, chat.Name, chat.LastMessageAt, truncatePreview(chat.LastMessagePreview), chat.SectorID, chat.Status, chat.CreatedAt, chat.UpdatedAt)
	return err
}

func truncatePreview(s string) string {
	const max = 100
	if len(s) <= max {
		return s
	}
	return s[:max]
}

func (r *SQLChat) GetByInstanceAndRemoteJID(ctx context.Context, instanceID, remoteJID string) (*models.Chat, error) {
	query := `SELECT id, instance_id, remote_jid, name, last_message_at, last_message_preview, sector_id, status, created_at, updated_at FROM chats WHERE instance_id = $1 AND remote_jid = $2`
	var c models.Chat
	var lastAt sql.NullTime
	var sectorID sql.NullString
	var status sql.NullString
	err := r.db.QueryRowContext(ctx, query, instanceID, remoteJID).Scan(
		&c.ID, &c.InstanceID, &c.RemoteJID, &c.Name, &lastAt, &c.LastMessagePreview, &sectorID, &status, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get chat: %w", err)
	}
	if lastAt.Valid {
		c.LastMessageAt = &lastAt.Time
	}
	if sectorID.Valid {
		id := sectorID.String
		c.SectorID = &id
	}
	if status.Valid {
		c.Status = status.String
	}
	if c.Status == "" {
		c.Status = "aguardando"
	}
	return &c, nil
}

func (r *SQLChat) ListByInstanceID(ctx context.Context, instanceID string, limit int, allowedSectorIDs []string) ([]models.Chat, error) {
	if limit <= 0 || limit > 100 {
		limit = 100
	}
	query := `SELECT id, instance_id, remote_jid, name, last_message_at, last_message_preview, sector_id, status, created_at, updated_at
		FROM chats WHERE instance_id = $1`
	args := []interface{}{instanceID}
	if len(allowedSectorIDs) > 0 {
		query += ` AND sector_id IN (`
		for i, sid := range allowedSectorIDs {
			if i > 0 {
				query += `,`
			}
			query += fmt.Sprintf("$%d", i+2)
			args = append(args, sid)
		}
		query += `)`
	}
	args = append(args, limit)
	query += ` ORDER BY COALESCE(last_message_at, updated_at) DESC LIMIT $` + fmt.Sprintf("%d", len(args))
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list chats: %w", err)
	}
	defer rows.Close()
	var list []models.Chat
	for rows.Next() {
		var c models.Chat
		var lastAt sql.NullTime
		var sectorID sql.NullString
		var status sql.NullString
		if err := rows.Scan(&c.ID, &c.InstanceID, &c.RemoteJID, &c.Name, &lastAt, &c.LastMessagePreview, &sectorID, &status, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		if lastAt.Valid {
			c.LastMessageAt = &lastAt.Time
		}
		if sectorID.Valid {
			id := sectorID.String
			c.SectorID = &id
		}
		if status.Valid {
			c.Status = status.String
		}
		if c.Status == "" {
			c.Status = "aguardando"
		}
		list = append(list, c)
	}
	return list, nil
}

func (r *SQLChat) GetByID(ctx context.Context, id string) (*models.Chat, error) {
	query := `SELECT id, instance_id, remote_jid, name, last_message_at, last_message_preview, sector_id, status, created_at, updated_at FROM chats WHERE id = $1`
	var c models.Chat
	var lastAt sql.NullTime
	var sectorID sql.NullString
	var status sql.NullString
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&c.ID, &c.InstanceID, &c.RemoteJID, &c.Name, &lastAt, &c.LastMessagePreview, &sectorID, &status, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get chat: %w", err)
	}
	if lastAt.Valid {
		c.LastMessageAt = &lastAt.Time
	}
	if sectorID.Valid {
		id := sectorID.String
		c.SectorID = &id
	}
	if status.Valid {
		c.Status = status.String
	}
	if c.Status == "" {
		c.Status = "aguardando"
	}
	return &c, nil
}

// UpdateStatusAndSector atualiza status e/ou setor de um chat.
func (r *SQLChat) UpdateStatusAndSector(ctx context.Context, id string, status string, sectorID *string) error {
	query := `UPDATE chats SET status = $1, sector_id = $2, updated_at = $3 WHERE id = $4`
	_, err := r.db.ExecContext(ctx, query, status, sectorID, time.Now(), id)
	return err
}

// CountByInstanceIDsGroupByStatus retorna contagem por status para as instâncias dadas.
func (r *SQLChat) CountByInstanceIDsGroupByStatus(ctx context.Context, instanceIDs []string) (aguardando, atendendo, finalizado int, err error) {
	if len(instanceIDs) == 0 {
		return 0, 0, 0, nil
	}
	placeholders := ""
	args := make([]interface{}, 0, len(instanceIDs))
	for i, id := range instanceIDs {
		if i > 0 {
			placeholders += ","
		}
		placeholders += fmt.Sprintf("$%d", i+1)
		args = append(args, id)
	}
	query := fmt.Sprintf(`SELECT COALESCE(status, 'aguardando') as st, COUNT(*) FROM chats WHERE instance_id IN (%s) GROUP BY COALESCE(status, 'aguardando')`, placeholders)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("count by status: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var st string
		var n int
		if err := rows.Scan(&st, &n); err != nil {
			return 0, 0, 0, err
		}
		switch st {
		case "aguardando":
			aguardando = n
		case "atendendo":
			atendendo = n
		case "finalizado":
			finalizado = n
		}
	}
	return aguardando, atendendo, finalizado, nil
}
