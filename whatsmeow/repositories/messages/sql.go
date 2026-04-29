package messages

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

var _ interfaces.MessageRepository = (*SQLMessage)(nil)

var ErrNotFound = errors.New("message not found")

const maxLimit = 100

type SQLMessage struct {
	db *sql.DB
}

func NewSQL() (*SQLMessage, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLMessage{db: db}, nil
}

func (r *SQLMessage) Create(ctx context.Context, msg *models.Message) error {
	if msg.ID == "" {
		msg.ID = uuid.New().String()
	}
	if msg.CreatedAt.IsZero() {
		msg.CreatedAt = time.Now()
	}
	query := `INSERT INTO messages (id, chat_id, wa_message_id, from_me, message_type, content, media_url, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (chat_id, wa_message_id) DO NOTHING`
	result, err := r.db.ExecContext(ctx, query,
		msg.ID, msg.ChatID, msg.WAMessageID, msg.FromMe, msg.MessageType, msg.Content, msg.MediaURL, msg.Status, msg.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create message: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return interfaces.ErrMessageDuplicate
	}
	return nil
}

func (r *SQLMessage) UpdateStatus(ctx context.Context, chatID, waMessageID, status string) error {
	query := `UPDATE messages SET status = $1 WHERE chat_id = $2 AND wa_message_id = $3`
	_, err := r.db.ExecContext(ctx, query, status, chatID, waMessageID)
	return err
}

func (r *SQLMessage) ListByChatID(ctx context.Context, chatID string, limit int, beforeID string) ([]models.Message, error) {
	if limit <= 0 || limit > maxLimit {
		limit = 50
	}
	if beforeID == "" {
		query := `SELECT id, chat_id, wa_message_id, from_me, message_type, content, media_url, status, created_at
			FROM messages WHERE chat_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`
		rows, err := r.db.QueryContext(ctx, query, chatID, limit)
		if err != nil {
			return nil, fmt.Errorf("failed to list messages: %w", err)
		}
		defer rows.Close()
		return scanMessages(rows)
	}
	var cursorAt time.Time
	err := r.db.QueryRowContext(ctx, `SELECT created_at FROM messages WHERE id = $1 AND chat_id = $2`, beforeID, chatID).Scan(&cursorAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	query := `SELECT id, chat_id, wa_message_id, from_me, message_type, content, media_url, status, created_at
		FROM messages WHERE chat_id = $1 AND (created_at < $2 OR (created_at = $2 AND id < $3))
		ORDER BY created_at DESC, id DESC LIMIT $4`
	rows, err := r.db.QueryContext(ctx, query, chatID, cursorAt, beforeID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list messages: %w", err)
	}
	defer rows.Close()
	return scanMessages(rows)
}

func scanMessages(rows *sql.Rows) ([]models.Message, error) {
	var list []models.Message
	for rows.Next() {
		var m models.Message
		if err := rows.Scan(&m.ID, &m.ChatID, &m.WAMessageID, &m.FromMe, &m.MessageType, &m.Content, &m.MediaURL, &m.Status, &m.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, nil
}

func (r *SQLMessage) GetByID(ctx context.Context, id string) (*models.Message, error) {
	query := `SELECT id, chat_id, wa_message_id, from_me, message_type, content, media_url, status, created_at FROM messages WHERE id = $1`
	var m models.Message
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&m.ID, &m.ChatID, &m.WAMessageID, &m.FromMe, &m.MessageType, &m.Content, &m.MediaURL, &m.Status, &m.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get message: %w", err)
	}
	return &m, nil
}

func (r *SQLMessage) CountSentByInstanceIDsBetween(ctx context.Context, instanceIDs []string, start, end time.Time) (int, error) {
	if len(instanceIDs) == 0 {
		return 0, nil
	}
	placeholders := ""
	args := make([]interface{}, 0, len(instanceIDs)+2)
	for i, id := range instanceIDs {
		if i > 0 {
			placeholders += ","
		}
		placeholders += fmt.Sprintf("$%d", i+1)
		args = append(args, id)
	}
	args = append(args, start, end)
	query := fmt.Sprintf(`SELECT COUNT(*) FROM messages m
		INNER JOIN chats c ON m.chat_id = c.id
		WHERE c.instance_id IN (%s) AND (m.from_me = 1 OR m.from_me = true) AND m.created_at >= $%d AND m.created_at < $%d`,
		placeholders, len(instanceIDs)+1, len(instanceIDs)+2)
	if len(instanceIDs) == 1 {
		query = `SELECT COUNT(*) FROM messages m
			INNER JOIN chats c ON m.chat_id = c.id
			WHERE c.instance_id = $1 AND (m.from_me = 1 OR m.from_me = true) AND m.created_at >= $2 AND m.created_at < $3`
	}
	var n int
	err := r.db.QueryRowContext(ctx, query, args...).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count messages: %w", err)
	}
	return n, nil
}
