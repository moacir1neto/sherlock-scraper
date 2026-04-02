package incidents

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

var _ interfaces.IncidentRepository = (*SQLIncident)(nil)

var ErrNotFound = errors.New("incident not found")

const defaultLimit = 50
const maxLimit = 200

type SQLIncident struct {
	db *sql.DB
}

func NewSQL() (*SQLIncident, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLIncident{db: db}, nil
}

func (r *SQLIncident) Create(ctx context.Context, inc *models.Incident) error {
	if inc.ID == "" {
		inc.ID = uuid.New().String()
	}
	if inc.CreatedAt.IsZero() {
		inc.CreatedAt = time.Now()
	}
	query := `INSERT INTO incidents (id, tenant_id, company_id, user_id, instance_id, code, message, context_type, context_id, request_path, request_method, payload_json, error_detail, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`
	_, err := r.db.ExecContext(ctx, query,
		inc.ID, inc.TenantID, inc.CompanyID, inc.UserID, inc.InstanceID, inc.Code, inc.Message, inc.ContextType, inc.ContextID,
		inc.RequestPath, inc.RequestMethod, inc.PayloadJSON, inc.ErrorDetail, inc.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create incident: %w", err)
	}
	return nil
}

func (r *SQLIncident) List(ctx context.Context, limit, offset int, code, tenantID string) ([]models.Incident, int, error) {
	if limit <= 0 || limit > maxLimit {
		limit = defaultLimit
	}
	if offset < 0 {
		offset = 0
	}

	where := "1=1"
	args := []interface{}{}
	argIdx := 1
	if code != "" {
		where += fmt.Sprintf(" AND code = $%d", argIdx)
		args = append(args, code)
		argIdx++
	}
	if tenantID != "" {
		where += fmt.Sprintf(" AND (tenant_id = $%d OR company_id = $%d)", argIdx, argIdx)
		args = append(args, tenantID)
		argIdx++
	}

	var total int
	countQuery := "SELECT COUNT(*) FROM incidents WHERE " + where
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count incidents: %w", err)
	}

	args = append(args, limit, offset)
	listQuery := `SELECT id, tenant_id, company_id, user_id, instance_id, code, message, context_type, context_id, request_path, request_method, payload_json, error_detail, created_at
		FROM incidents WHERE ` + where + ` ORDER BY created_at DESC LIMIT $` + fmt.Sprint(argIdx) + ` OFFSET $` + fmt.Sprint(argIdx+1)
	rows, err := r.db.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list incidents: %w", err)
	}
	defer rows.Close()

	var list []models.Incident
	for rows.Next() {
		var inc models.Incident
		var tenantID, companyID, userID sql.NullString
		err := rows.Scan(&inc.ID, &tenantID, &companyID, &userID, &inc.InstanceID, &inc.Code, &inc.Message, &inc.ContextType, &inc.ContextID,
			&inc.RequestPath, &inc.RequestMethod, &inc.PayloadJSON, &inc.ErrorDetail, &inc.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		if tenantID.Valid {
			inc.TenantID = &tenantID.String
		}
		if companyID.Valid {
			inc.CompanyID = &companyID.String
		}
		if userID.Valid {
			inc.UserID = &userID.String
		}
		list = append(list, inc)
	}
	return list, total, nil
}

func (r *SQLIncident) GetByID(ctx context.Context, id string) (*models.Incident, error) {
	query := `SELECT id, tenant_id, company_id, user_id, instance_id, code, message, context_type, context_id, request_path, request_method, payload_json, error_detail, created_at
		FROM incidents WHERE id = $1`
	var inc models.Incident
	var tenantID, companyID, userID sql.NullString
	err := r.db.QueryRowContext(ctx, query, id).Scan(&inc.ID, &tenantID, &companyID, &userID, &inc.InstanceID, &inc.Code, &inc.Message, &inc.ContextType, &inc.ContextID,
		&inc.RequestPath, &inc.RequestMethod, &inc.PayloadJSON, &inc.ErrorDetail, &inc.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if tenantID.Valid {
		inc.TenantID = &tenantID.String
	}
	if companyID.Valid {
		inc.CompanyID = &companyID.String
	}
	if userID.Valid {
		inc.UserID = &userID.String
	}
	return &inc, nil
}
