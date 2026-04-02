package scrapes

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

var _ interfaces.ScrapeRepository = (*SQLScrape)(nil)

var ErrNotFound = errors.New("scrape not found")

type SQLScrape struct {
	db *sql.DB
}

func NewSQL() (*SQLScrape, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLScrape{db: db}, nil
}

func (r *SQLScrape) Create(ctx context.Context, scrape *models.Scrape) error {
	if scrape.ID == "" {
		scrape.ID = uuid.New().String()
	}
	now := time.Now()
	scrape.CreatedAt = now
	scrape.UpdatedAt = now
	if scrape.Status == "" {
		scrape.Status = "running"
	}

	query := `INSERT INTO scrapes (id, company_id, user_id, keyword, location, status, total_leads, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`
	_, err := r.db.ExecContext(ctx, query,
		scrape.ID, scrape.CompanyID, scrape.UserID, scrape.Keyword, scrape.Location,
		scrape.Status, scrape.TotalLeads, scrape.CreatedAt, scrape.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("create scrape: %w", err)
	}
	return nil
}

func (r *SQLScrape) GetByID(ctx context.Context, id, companyID string) (*models.Scrape, error) {
	query := `SELECT id, company_id, user_id, keyword, location, status, total_leads, created_at, updated_at
		FROM scrapes WHERE id=$1 AND company_id=$2`
	var s models.Scrape
	err := r.db.QueryRowContext(ctx, query, id, companyID).Scan(
		&s.ID, &s.CompanyID, &s.UserID, &s.Keyword, &s.Location,
		&s.Status, &s.TotalLeads, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get scrape: %w", err)
	}
	return &s, nil
}

func (r *SQLScrape) ListByCompanyID(ctx context.Context, companyID string) ([]models.Scrape, error) {
	var (
		query string
		args  []any
	)
	if companyID != "" {
		query = `SELECT id, company_id, user_id, keyword, location, status, total_leads, created_at, updated_at
			FROM scrapes WHERE company_id=$1 ORDER BY created_at DESC`
		args = []any{companyID}
	} else {
		// super_admin sem empresa: retorna todas as campanhas
		query = `SELECT id, company_id, user_id, keyword, location, status, total_leads, created_at, updated_at
			FROM scrapes ORDER BY created_at DESC`
		args = []any{}
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list scrapes: %w", err)
	}
	defer rows.Close()

	var list []models.Scrape
	for rows.Next() {
		var s models.Scrape
		if err := rows.Scan(
			&s.ID, &s.CompanyID, &s.UserID, &s.Keyword, &s.Location,
			&s.Status, &s.TotalLeads, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}
	return list, nil
}

func (r *SQLScrape) UpdateStatus(ctx context.Context, id, status string, totalLeads int) error {
	query := `UPDATE scrapes SET status=$1, total_leads=$2, updated_at=$3 WHERE id=$4`
	res, err := r.db.ExecContext(ctx, query, status, totalLeads, time.Now(), id)
	if err != nil {
		return fmt.Errorf("update scrape status: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *SQLScrape) Delete(ctx context.Context, id, companyID string) error {
	query := `DELETE FROM scrapes WHERE id=$1 AND company_id=$2`
	res, err := r.db.ExecContext(ctx, query, id, companyID)
	if err != nil {
		return fmt.Errorf("delete scrape: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
