package webhook_logs

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

const maxBodyLen = 2048

var _ interfaces.WebhookLogRepository = (*SQLWebhookLog)(nil)

var ErrNotFound = errors.New("webhook log not found")

type SQLWebhookLog struct {
	db *sql.DB
}

func NewSQL() (*SQLWebhookLog, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLWebhookLog{db: db}, nil
}

func (r *SQLWebhookLog) Create(ctx context.Context, log *models.WebhookLog) error {
	if log.ID == "" {
		log.ID = uuid.New().String()
	}
	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now()
	}
	if len(log.RequestBody) > maxBodyLen {
		log.RequestBody = log.RequestBody[:maxBodyLen]
	}
	if len(log.ResponseBody) > maxBodyLen {
		log.ResponseBody = log.ResponseBody[:maxBodyLen]
	}
	query := `INSERT INTO webhook_logs (id, instance_id, company_id, event_type, url, request_body, response_status, response_body, error_message, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
	_, err := r.db.ExecContext(ctx, query,
		log.ID, log.InstanceID, log.CompanyID, log.EventType, log.URL, log.RequestBody, log.ResponseStatus, log.ResponseBody, log.ErrorMessage, log.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create webhook log: %w", err)
	}
	return nil
}

func (r *SQLWebhookLog) List(ctx context.Context, instanceID, companyID, eventType string, limit, offset int) ([]models.WebhookLog, int, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	where := "1=1"
	args := []interface{}{}
	argIdx := 1
	if instanceID != "" {
		where += fmt.Sprintf(" AND instance_id = $%d", argIdx)
		args = append(args, instanceID)
		argIdx++
	}
	if companyID != "" {
		where += fmt.Sprintf(" AND company_id = $%d", argIdx)
		args = append(args, companyID)
		argIdx++
	}
	if eventType != "" {
		where += fmt.Sprintf(" AND event_type = $%d", argIdx)
		args = append(args, eventType)
		argIdx++
	}

	var total int
	countQuery := "SELECT COUNT(*) FROM webhook_logs WHERE " + where
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count webhook_logs: %w", err)
	}

	listQuery := "SELECT id, instance_id, company_id, event_type, url, request_body, response_status, response_body, error_message, created_at FROM webhook_logs WHERE " + where + " ORDER BY created_at DESC LIMIT $" + fmt.Sprint(len(args)+1) + " OFFSET $" + fmt.Sprint(len(args)+2)
	args = append(args, limit, offset)
	rows, err := r.db.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list webhook_logs: %w", err)
	}
	defer rows.Close()

	var list []models.WebhookLog
	for rows.Next() {
		var w models.WebhookLog
		var companyIDNull sql.NullString
		var reqBody, respBody, errMsg sql.NullString
		var respStatus sql.NullInt64
		if err := rows.Scan(&w.ID, &w.InstanceID, &companyIDNull, &w.EventType, &w.URL, &reqBody, &respStatus, &respBody, &errMsg, &w.CreatedAt); err != nil {
			return nil, 0, err
		}
		if companyIDNull.Valid {
			w.CompanyID = &companyIDNull.String
		}
		if reqBody.Valid {
			w.RequestBody = reqBody.String
		}
		if respBody.Valid {
			w.ResponseBody = respBody.String
		}
		if errMsg.Valid {
			w.ErrorMessage = errMsg.String
		}
		if respStatus.Valid {
			s := int(respStatus.Int64)
			w.ResponseStatus = &s
		}
		list = append(list, w)
	}
	return list, total, nil
}

func (r *SQLWebhookLog) GetByID(ctx context.Context, id string) (*models.WebhookLog, error) {
	query := `SELECT id, instance_id, company_id, event_type, url, request_body, response_status, response_body, error_message, created_at FROM webhook_logs WHERE id = $1`
	var w models.WebhookLog
	var companyIDNull sql.NullString
	var reqBody, respBody, errMsg sql.NullString
	var respStatus sql.NullInt64
	err := r.db.QueryRowContext(ctx, query, id).Scan(&w.ID, &w.InstanceID, &companyIDNull, &w.EventType, &w.URL, &reqBody, &respStatus, &respBody, &errMsg, &w.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if companyIDNull.Valid {
		w.CompanyID = &companyIDNull.String
	}
	if reqBody.Valid {
		w.RequestBody = reqBody.String
	}
	if respBody.Valid {
		w.ResponseBody = respBody.String
	}
	if errMsg.Valid {
		w.ErrorMessage = errMsg.String
	}
	if respStatus.Valid {
		s := int(respStatus.Int64)
		w.ResponseStatus = &s
	}
	return &w, nil
}
