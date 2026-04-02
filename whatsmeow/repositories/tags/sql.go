package tags

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/services"
)

var _ interfaces.TagRepository = (*SQLTag)(nil)

var ErrNotFound = errors.New("tag not found")

type SQLTag struct {
	db *sql.DB
}

func NewSQL() (*SQLTag, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLTag{db: db}, nil
}

func (r *SQLTag) Create(ctx context.Context, tag *models.Tag) error {
	if tag.ID == "" {
		tag.ID = uuid.New().String()
	}
	if tag.CreatedAt.IsZero() {
		tag.CreatedAt = time.Now()
	}
	query := `INSERT INTO tags (id, company_id, name, color, kanban_enabled, sort_order, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.ExecContext(ctx, query, tag.ID, tag.CompanyID, tag.Name, tag.Color, tag.KanbanEnabled, tag.SortOrder, tag.CreatedAt)
	if err != nil {
		return fmt.Errorf("create tag: %w", err)
	}
	return nil
}

func (r *SQLTag) Update(ctx context.Context, tag *models.Tag) error {
	query := `UPDATE tags SET name = $1, color = $2, kanban_enabled = $3, sort_order = $4 WHERE id = $5 AND company_id = $6`
	res, err := r.db.ExecContext(ctx, query, tag.Name, tag.Color, tag.KanbanEnabled, tag.SortOrder, tag.ID, tag.CompanyID)
	if err != nil {
		return fmt.Errorf("update tag: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *SQLTag) Delete(ctx context.Context, id, companyID string) error {
	query := `DELETE FROM tags WHERE id = $1 AND company_id = $2`
	res, err := r.db.ExecContext(ctx, query, id, companyID)
	if err != nil {
		return fmt.Errorf("delete tag: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *SQLTag) GetByID(ctx context.Context, id, companyID string) (*models.Tag, error) {
	query := `SELECT id, company_id, name, color, kanban_enabled, sort_order, created_at FROM tags WHERE id = $1 AND company_id = $2`
	var t models.Tag
	var kanbanEnabled sql.NullBool
	var sortOrder sql.NullInt64
	err := r.db.QueryRowContext(ctx, query, id, companyID).Scan(&t.ID, &t.CompanyID, &t.Name, &t.Color, &kanbanEnabled, &sortOrder, &t.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get tag: %w", err)
	}
	t.KanbanEnabled = kanbanEnabled.Bool
	t.SortOrder = int(sortOrder.Int64)
	return &t, nil
}

func (r *SQLTag) ListByCompanyID(ctx context.Context, companyID string) ([]models.Tag, error) {
	query := `SELECT id, company_id, name, color, kanban_enabled, sort_order, created_at FROM tags WHERE company_id = $1 ORDER BY sort_order ASC, name ASC`
	rows, err := r.db.QueryContext(ctx, query, companyID)
	if err != nil {
		return nil, fmt.Errorf("list tags: %w", err)
	}
	defer rows.Close()
	var list []models.Tag
	for rows.Next() {
		var t models.Tag
		var kanbanEnabled sql.NullBool
		var sortOrder sql.NullInt64
		if err := rows.Scan(&t.ID, &t.CompanyID, &t.Name, &t.Color, &kanbanEnabled, &sortOrder, &t.CreatedAt); err != nil {
			return nil, err
		}
		t.KanbanEnabled = kanbanEnabled.Bool
		t.SortOrder = int(sortOrder.Int64)
		list = append(list, t)
	}
	return list, nil
}

func (r *SQLTag) CountUsage(ctx context.Context, tagID, companyID string) (int, error) {
	query := `SELECT COUNT(*) FROM chat_tags ct INNER JOIN tags t ON ct.tag_id = t.id WHERE ct.tag_id = $1 AND t.company_id = $2`
	var n int
	err := r.db.QueryRowContext(ctx, query, tagID, companyID).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count tag usage: %w", err)
	}
	return n, nil
}
