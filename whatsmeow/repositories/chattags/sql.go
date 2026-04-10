package chattags

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/services"
)

var _ interfaces.ChatTagRepository = (*SQLChatTag)(nil)

type SQLChatTag struct {
	db *sql.DB
}

func NewSQL() (*SQLChatTag, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLChatTag{db: db}, nil
}

func (r *SQLChatTag) Add(ctx context.Context, chatID, tagID string) error {
	query := `INSERT INTO chat_tags (chat_id, tag_id, created_at) VALUES ($1, $2, $3) ON CONFLICT (chat_id, tag_id) DO NOTHING`
	_, err := r.db.ExecContext(ctx, query, chatID, tagID, time.Now())
	if err != nil {
		return fmt.Errorf("add chat tag: %w", err)
	}
	return nil
}

func (r *SQLChatTag) Remove(ctx context.Context, chatID, tagID string) error {
	query := `DELETE FROM chat_tags WHERE chat_id = $1 AND tag_id = $2`
	_, err := r.db.ExecContext(ctx, query, chatID, tagID)
	return err
}

func (r *SQLChatTag) ListByChatID(ctx context.Context, chatID string) ([]models.Tag, error) {
	query := `SELECT t.id, t.company_id, t.name, t.color, t.created_at FROM tags t INNER JOIN chat_tags ct ON ct.tag_id = t.id WHERE ct.chat_id = $1 ORDER BY t.name`
	rows, err := r.db.QueryContext(ctx, query, chatID)
	if err != nil {
		return nil, fmt.Errorf("list tags by chat: %w", err)
	}
	defer rows.Close()
	var list []models.Tag
	for rows.Next() {
		var t models.Tag
		if err := rows.Scan(&t.ID, &t.CompanyID, &t.Name, &t.Color, &t.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, nil
}

func (r *SQLChatTag) ListChatIDsByTagID(ctx context.Context, tagID string) ([]string, error) {
	query := `SELECT chat_id FROM chat_tags WHERE tag_id = $1`
	rows, err := r.db.QueryContext(ctx, query, tagID)
	if err != nil {
		return nil, fmt.Errorf("list chats by tag: %w", err)
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
