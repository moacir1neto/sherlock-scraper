package flows

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

var _ interfaces.FlowRepository = (*SQLFlow)(nil)

var ErrNotFound = errors.New("flow not found")

type SQLFlow struct {
	db *sql.DB
}

func NewSQL() (*SQLFlow, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLFlow{db: db}, nil
}

func (r *SQLFlow) Create(ctx context.Context, f *models.Flow) error {
	if f.ID == "" {
		f.ID = uuid.New().String()
	}
	now := time.Now()
	if f.CreatedAt.IsZero() {
		f.CreatedAt = now
	}
	f.UpdatedAt = now
	query := `INSERT INTO flows (id, company_id, name, command, definition, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`
	def := f.Definition
	if def == nil {
		def = []byte("{}")
	}
	_, err := r.db.ExecContext(ctx, query, f.ID, f.CompanyID, f.Name, f.Command, def, f.CreatedAt, f.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create flow: %w", err)
	}
	return nil
}

func (r *SQLFlow) Update(ctx context.Context, f *models.Flow) error {
	f.UpdatedAt = time.Now()
	def := f.Definition
	if def == nil {
		def = []byte("{}")
	}
	query := `UPDATE flows SET name = $1, command = $2, definition = $3, updated_at = $4 WHERE id = $5 AND company_id = $6`
	res, err := r.db.ExecContext(ctx, query, f.Name, f.Command, def, f.UpdatedAt, f.ID, f.CompanyID)
	if err != nil {
		return fmt.Errorf("update flow: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *SQLFlow) Delete(ctx context.Context, id, companyID string) error {
	query := `DELETE FROM flows WHERE id = $1 AND company_id = $2`
	res, err := r.db.ExecContext(ctx, query, id, companyID)
	if err != nil {
		return fmt.Errorf("delete flow: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *SQLFlow) GetByID(ctx context.Context, id, companyID string) (*models.Flow, error) {
	query := `SELECT id, company_id, name, command, definition, created_at, updated_at FROM flows WHERE id = $1 AND company_id = $2`
	var f models.Flow
	var def []byte
	err := r.db.QueryRowContext(ctx, query, id, companyID).Scan(&f.ID, &f.CompanyID, &f.Name, &f.Command, &def, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get flow: %w", err)
	}
	if len(def) > 0 {
		f.Definition = def
	} else {
		f.Definition = []byte("{}")
	}
	return &f, nil
}

func (r *SQLFlow) ListByCompanyID(ctx context.Context, companyID string) ([]models.Flow, error) {
	query := `SELECT id, company_id, name, command, definition, created_at, updated_at FROM flows WHERE company_id = $1 ORDER BY updated_at DESC`
	rows, err := r.db.QueryContext(ctx, query, companyID)
	if err != nil {
		return nil, fmt.Errorf("list flows: %w", err)
	}
	defer rows.Close()
	var list []models.Flow
	for rows.Next() {
		var f models.Flow
		var def []byte
		if err := rows.Scan(&f.ID, &f.CompanyID, &f.Name, &f.Command, &def, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		if len(def) > 0 {
			f.Definition = def
		} else {
			f.Definition = []byte("{}")
		}
		list = append(list, f)
	}
	return list, nil
}
