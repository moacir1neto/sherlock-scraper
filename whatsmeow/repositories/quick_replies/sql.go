package quick_replies

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/services"
)

var _ interfaces.QuickReplyRepository = (*SQLQuickReply)(nil)

var ErrNotFound = errors.New("quick reply not found")

type SQLQuickReply struct {
	db *sql.DB
}

func NewSQL() (*SQLQuickReply, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLQuickReply{db: db}, nil
}

func normalizeCommand(cmd string) string {
	cmd = strings.TrimSpace(strings.ToLower(cmd))
	return strings.TrimPrefix(cmd, "/")
}

func (r *SQLQuickReply) Create(ctx context.Context, q *models.QuickReply) error {
	if q.ID == "" {
		q.ID = uuid.New().String()
	}
	if q.CreatedAt.IsZero() {
		q.CreatedAt = time.Now()
	}
	q.Command = normalizeCommand(q.Command)
	query := `INSERT INTO quick_replies (id, company_id, command, message, created_at) VALUES ($1, $2, $3, $4, $5)`
	_, err := r.db.ExecContext(ctx, query, q.ID, q.CompanyID, q.Command, q.Message, q.CreatedAt)
	if err != nil {
		return fmt.Errorf("create quick_reply: %w", err)
	}
	return nil
}

func (r *SQLQuickReply) Update(ctx context.Context, q *models.QuickReply) error {
	q.Command = normalizeCommand(q.Command)
	query := `UPDATE quick_replies SET command = $1, message = $2 WHERE id = $3 AND company_id = $4`
	res, err := r.db.ExecContext(ctx, query, q.Command, q.Message, q.ID, q.CompanyID)
	if err != nil {
		return fmt.Errorf("update quick_reply: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *SQLQuickReply) Delete(ctx context.Context, id, companyID string) error {
	query := `DELETE FROM quick_replies WHERE id = $1 AND company_id = $2`
	res, err := r.db.ExecContext(ctx, query, id, companyID)
	if err != nil {
		return fmt.Errorf("delete quick_reply: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *SQLQuickReply) GetByID(ctx context.Context, id, companyID string) (*models.QuickReply, error) {
	query := `SELECT id, company_id, command, message, created_at FROM quick_replies WHERE id = $1 AND company_id = $2`
	var q models.QuickReply
	err := r.db.QueryRowContext(ctx, query, id, companyID).Scan(&q.ID, &q.CompanyID, &q.Command, &q.Message, &q.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get quick_reply: %w", err)
	}
	return &q, nil
}

func (r *SQLQuickReply) ListByCompanyID(ctx context.Context, companyID string) ([]models.QuickReply, error) {
	query := `SELECT id, company_id, command, message, created_at FROM quick_replies WHERE company_id = $1 ORDER BY command ASC`
	rows, err := r.db.QueryContext(ctx, query, companyID)
	if err != nil {
		return nil, fmt.Errorf("list quick_replies: %w", err)
	}
	defer rows.Close()
	var list []models.QuickReply
	for rows.Next() {
		var q models.QuickReply
		if err := rows.Scan(&q.ID, &q.CompanyID, &q.Command, &q.Message, &q.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, q)
	}
	return list, nil
}
