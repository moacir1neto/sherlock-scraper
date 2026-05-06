package users

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

var _ interfaces.UserRepository = (*SQLUser)(nil)

var ErrorNotFound = errors.New("user not found")
var ErrorAlreadyExists = errors.New("user already exists")

type SQLUser struct {
	db *sql.DB
}

func NewSQL() (*SQLUser, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLUser{db: db}, nil
}

func (r *SQLUser) Create(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (id, nome, email, senha, role, company_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now

	_, err := r.db.ExecContext(ctx, query,
		user.ID, user.Nome, user.Email, user.Senha,
		user.Role, user.CompanyID, user.CreatedAt, user.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}
	return nil
}

func (r *SQLUser) List(ctx context.Context, companyID *string) ([]models.User, error) {
	var query string
	var args []interface{}

	if companyID != nil && *companyID != "" {
		query = `SELECT id, nome, email, senha, role, company_id, created_at, updated_at FROM users WHERE company_id = $1 ORDER BY created_at DESC`
		args = []interface{}{*companyID}
	} else {
		query = `SELECT id, nome, email, senha, role, company_id, created_at, updated_at FROM users ORDER BY created_at DESC`
		args = []interface{}{}
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		var companyID sql.NullString
		err := rows.Scan(
			&u.ID, &u.Nome, &u.Email, &u.Senha,
			&u.Role, &companyID, &u.CreatedAt, &u.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		// Convert sql.NullString to *string
		if companyID.Valid {
			u.CompanyID = &companyID.String
		} else {
			u.CompanyID = nil
		}
		users = append(users, u)
	}

	return users, nil
}

func (r *SQLUser) GetByID(ctx context.Context, id string) (*models.User, error) {
	query := `SELECT id, nome, email, senha, role, company_id, created_at, updated_at FROM users WHERE id = $1`

	var u models.User
	var companyID sql.NullString
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&u.ID, &u.Nome, &u.Email, &u.Senha,
		&u.Role, &companyID, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrorNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Convert sql.NullString to *string
	if companyID.Valid {
		u.CompanyID = &companyID.String
	} else {
		u.CompanyID = nil
	}

	return &u, nil
}

func (r *SQLUser) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `SELECT id, nome, email, senha, role, company_id, created_at, updated_at FROM users WHERE email = $1`

	var u models.User
	var companyID sql.NullString
	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&u.ID, &u.Nome, &u.Email, &u.Senha,
		&u.Role, &companyID, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrorNotFound
		}
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}

	// Convert sql.NullString to *string
	if companyID.Valid {
		u.CompanyID = &companyID.String
	} else {
		u.CompanyID = nil
	}

	return &u, nil
}

func (r *SQLUser) Update(ctx context.Context, id string, user *models.User) (*models.User, error) {
	query := `
		UPDATE users 
		SET nome = $1, email = $2, senha = $3, role = $4, company_id = $5, updated_at = $6
		WHERE id = $7
		RETURNING id, nome, email, senha, role, company_id, created_at, updated_at
	`

	user.UpdatedAt = time.Now()
	var u models.User
	var companyID sql.NullString
	err := r.db.QueryRowContext(ctx, query,
		user.Nome, user.Email, user.Senha, user.Role,
		user.CompanyID, user.UpdatedAt, id,
	).Scan(
		&u.ID, &u.Nome, &u.Email, &u.Senha,
		&u.Role, &companyID, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrorNotFound
		}
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	// Convert sql.NullString to *string
	if companyID.Valid {
		u.CompanyID = &companyID.String
	} else {
		u.CompanyID = nil
	}

	return &u, nil
}

func (r *SQLUser) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM users WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
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
