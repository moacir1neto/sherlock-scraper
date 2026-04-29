package companies

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/services"
	"golang.org/x/net/context"
)

var _ interfaces.CompanyRepository = (*SQLCompany)(nil)

var ErrorNotFound = errors.New("company not found")
var ErrorAlreadyExists = errors.New("company already exists")

type SQLCompany struct {
	db *sql.DB
}

func NewSQL() (*SQLCompany, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLCompany{db: db}, nil
}

func (r *SQLCompany) Create(ctx context.Context, company *models.Company) error {
	query := `
		INSERT INTO companies (id, nome, cnpj, email, telefone, endereco, ativo, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	now := time.Now()
	company.CreatedAt = now
	company.UpdatedAt = now

	_, err := r.db.ExecContext(ctx, query,
		company.ID, company.Nome, company.CNPJ, company.Email,
		company.Telefone, company.Endereco, company.Ativo,
		company.CreatedAt, company.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create company: %w", err)
	}
	return nil
}

func (r *SQLCompany) List(ctx context.Context, id string) ([]models.Company, error) {
	var query string
	var args []interface{}

	if id != "" {
		query = `SELECT id, nome, cnpj, email, telefone, endereco, ativo, created_at, updated_at FROM companies WHERE id = $1`
		args = []interface{}{id}
	} else {
		query = `SELECT id, nome, cnpj, email, telefone, endereco, ativo, created_at, updated_at FROM companies ORDER BY created_at DESC`
		args = []interface{}{}
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list companies: %w", err)
	}
	defer rows.Close()

	var companies []models.Company
	for rows.Next() {
		var c models.Company
		err := rows.Scan(
			&c.ID, &c.Nome, &c.CNPJ, &c.Email,
			&c.Telefone, &c.Endereco, &c.Ativo,
			&c.CreatedAt, &c.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan company: %w", err)
		}
		companies = append(companies, c)
	}

	return companies, nil
}

func (r *SQLCompany) GetByID(ctx context.Context, id string) (*models.Company, error) {
	query := `SELECT id, nome, cnpj, email, telefone, endereco, ativo, created_at, updated_at FROM companies WHERE id = $1`

	var c models.Company
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&c.ID, &c.Nome, &c.CNPJ, &c.Email,
		&c.Telefone, &c.Endereco, &c.Ativo,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrorNotFound
		}
		return nil, fmt.Errorf("failed to get company: %w", err)
	}

	return &c, nil
}

func (r *SQLCompany) Update(ctx context.Context, id string, company *models.Company) (*models.Company, error) {
	query := `
		UPDATE companies 
		SET nome = $1, cnpj = $2, email = $3, telefone = $4, endereco = $5, ativo = $6, updated_at = $7
		WHERE id = $8
		RETURNING id, nome, cnpj, email, telefone, endereco, ativo, created_at, updated_at
	`

	company.UpdatedAt = time.Now()
	var c models.Company
	err := r.db.QueryRowContext(ctx, query,
		company.Nome, company.CNPJ, company.Email,
		company.Telefone, company.Endereco, company.Ativo,
		company.UpdatedAt, id,
	).Scan(
		&c.ID, &c.Nome, &c.CNPJ, &c.Email,
		&c.Telefone, &c.Endereco, &c.Ativo,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrorNotFound
		}
		return nil, fmt.Errorf("failed to update company: %w", err)
	}

	return &c, nil
}

func (r *SQLCompany) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM companies WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete company: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return ErrorNotFound
	}

	return nil
}

