package sectors

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

var _ interfaces.SectorRepository = (*SQLSector)(nil)

var ErrNotFound = errors.New("sector not found")

type SQLSector struct {
	db *sql.DB
}

func NewSQL() (*SQLSector, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLSector{db: db}, nil
}

func (r *SQLSector) Create(ctx context.Context, sector *models.Sector) error {
	if sector.ID == "" {
		sector.ID = uuid.New().String()
	}
	if sector.CreatedAt.IsZero() {
		sector.CreatedAt = time.Now()
	}
	query := `INSERT INTO sectors (id, company_id, name, slug, is_default, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := r.db.ExecContext(ctx, query,
		sector.ID, sector.CompanyID, sector.Name, sector.Slug, sector.IsDefault, sector.CreatedAt)
	if err != nil {
		return fmt.Errorf("create sector: %w", err)
	}
	return nil
}

func (r *SQLSector) Update(ctx context.Context, sector *models.Sector) error {
	query := `UPDATE sectors SET name = $1, slug = $2 WHERE id = $3 AND company_id = $4`
	res, err := r.db.ExecContext(ctx, query,
		sector.Name, sector.Slug, sector.ID, sector.CompanyID)
	if err != nil {
		return fmt.Errorf("update sector: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *SQLSector) Delete(ctx context.Context, id, companyID string) error {
	query := `DELETE FROM sectors WHERE id = $1 AND company_id = $2 AND is_default = 0`
	res, err := r.db.ExecContext(ctx, query, id, companyID)
	if err != nil {
		return fmt.Errorf("delete sector: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *SQLSector) GetByID(ctx context.Context, id, companyID string) (*models.Sector, error) {
	query := `SELECT id, company_id, name, slug, is_default, created_at FROM sectors WHERE id = $1 AND company_id = $2`
	var s models.Sector
	err := r.db.QueryRowContext(ctx, query, id, companyID).Scan(
		&s.ID, &s.CompanyID, &s.Name, &s.Slug, &s.IsDefault, &s.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get sector: %w", err)
	}
	return &s, nil
}

func (r *SQLSector) ListByCompanyID(ctx context.Context, companyID string) ([]models.Sector, error) {
	query := `SELECT id, company_id, name, slug, is_default, created_at FROM sectors WHERE company_id = $1 ORDER BY is_default DESC, name`
	rows, err := r.db.QueryContext(ctx, query, companyID)
	if err != nil {
		return nil, fmt.Errorf("list sectors: %w", err)
	}
	defer rows.Close()
	var list []models.Sector
	for rows.Next() {
		var s models.Sector
		if err := rows.Scan(&s.ID, &s.CompanyID, &s.Name, &s.Slug, &s.IsDefault, &s.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, nil
}

func (r *SQLSector) GetDefaultByCompanyID(ctx context.Context, companyID string) (*models.Sector, error) {
	query := `SELECT id, company_id, name, slug, is_default, created_at FROM sectors WHERE company_id = $1 AND is_default = 1 LIMIT 1`
	var s models.Sector
	err := r.db.QueryRowContext(ctx, query, companyID).Scan(
		&s.ID, &s.CompanyID, &s.Name, &s.Slug, &s.IsDefault, &s.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get default sector: %w", err)
	}
	return &s, nil
}
