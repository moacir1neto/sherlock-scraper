package audit_logs

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

var _ interfaces.AuditLogRepository = (*SQLAuditLog)(nil)

var ErrNotFound = errors.New("audit log not found")

type SQLAuditLog struct {
	db *sql.DB
}

func NewSQL() (*SQLAuditLog, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLAuditLog{db: db}, nil
}

func (r *SQLAuditLog) Create(ctx context.Context, log *models.AuditLog) error {
	if log.ID == "" {
		log.ID = uuid.New().String()
	}
	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now()
	}
	query := `INSERT INTO audit_logs (id, company_id, user_id, user_email, action, entity_type, entity_id, old_value, new_value, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
	_, err := r.db.ExecContext(ctx, query,
		log.ID, log.CompanyID, log.UserID, log.UserEmail, log.Action, log.EntityType, log.EntityID, log.OldValue, log.NewValue, log.CreatedAt)
	if err != nil {
		return fmt.Errorf("create audit log: %w", err)
	}
	return nil
}

func (r *SQLAuditLog) List(ctx context.Context, companyID string, limit, offset int) ([]models.AuditLog, int, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	where := "1=1"
	args := []interface{}{}
	argIdx := 1
	if companyID != "" {
		where += fmt.Sprintf(" AND company_id = $%d", argIdx)
		args = append(args, companyID)
		argIdx++
	}
	countQuery := "SELECT COUNT(*) FROM audit_logs WHERE " + where
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count audit_logs: %w", err)
	}
	listQuery := "SELECT id, company_id, user_id, user_email, action, entity_type, entity_id, old_value, new_value, created_at FROM audit_logs WHERE " + where +
		" ORDER BY created_at DESC LIMIT $" + fmt.Sprint(len(args)+1) + " OFFSET $" + fmt.Sprint(len(args)+2)
	args = append(args, limit, offset)
	rows, err := r.db.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list audit_logs: %w", err)
	}
	defer rows.Close()
	var list []models.AuditLog
	for rows.Next() {
		var l models.AuditLog
		var companyIDNull, userIDNull sql.NullString
		err := rows.Scan(&l.ID, &companyIDNull, &userIDNull, &l.UserEmail, &l.Action, &l.EntityType, &l.EntityID, &l.OldValue, &l.NewValue, &l.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		if companyIDNull.Valid {
			l.CompanyID = &companyIDNull.String
		}
		if userIDNull.Valid {
			l.UserID = &userIDNull.String
		}
		list = append(list, l)
	}
	return list, total, nil
}

func (r *SQLAuditLog) GetByID(ctx context.Context, id string) (*models.AuditLog, error) {
	query := `SELECT id, company_id, user_id, user_email, action, entity_type, entity_id, old_value, new_value, created_at FROM audit_logs WHERE id = $1`
	var l models.AuditLog
	var companyIDNull, userIDNull sql.NullString
	err := r.db.QueryRowContext(ctx, query, id).Scan(&l.ID, &companyIDNull, &userIDNull, &l.UserEmail, &l.Action, &l.EntityType, &l.EntityID, &l.OldValue, &l.NewValue, &l.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get audit log: %w", err)
	}
	if companyIDNull.Valid {
		l.CompanyID = &companyIDNull.String
	}
	if userIDNull.Valid {
		l.UserID = &userIDNull.String
	}
	return &l, nil
}
