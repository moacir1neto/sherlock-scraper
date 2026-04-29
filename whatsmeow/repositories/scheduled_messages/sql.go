package scheduled_messages

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

var _ interfaces.ScheduledMessageRepository = (*SQL)(nil)

var ErrNotFound = errors.New("scheduled message not found")

type SQL struct {
	db *sql.DB
}

func NewSQL() (*SQL, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQL{db: db}, nil
}

func (r *SQL) Create(ctx context.Context, m *models.ScheduledMessage) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	if m.CreatedAt.IsZero() {
		m.CreatedAt = time.Now()
	}
	if m.Status == "" {
		m.Status = "pending"
	}
	query := `INSERT INTO scheduled_messages (id, company_id, instance_id, remote_jid, message_type, content, media_url, scheduled_at, status, created_at, error_msg)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
	_, err := r.db.ExecContext(ctx, query,
		m.ID, m.CompanyID, m.InstanceID, m.RemoteJID, m.MessageType, m.Content, m.MediaURL,
		m.ScheduledAt, m.Status, m.CreatedAt, m.ErrorMsg)
	if err != nil {
		return fmt.Errorf("create scheduled_message: %w", err)
	}
	return nil
}

func (r *SQL) ListByCompanyID(ctx context.Context, companyID string) ([]models.ScheduledMessage, error) {
	query := `SELECT id, company_id, instance_id, remote_jid, message_type, content, media_url, scheduled_at, status, created_at, sent_at, error_msg
		FROM scheduled_messages WHERE company_id = $1 ORDER BY scheduled_at DESC`
	rows, err := r.db.QueryContext(ctx, query, companyID)
	if err != nil {
		return nil, fmt.Errorf("list scheduled_messages: %w", err)
	}
	defer rows.Close()
	var list []models.ScheduledMessage
	for rows.Next() {
		var m models.ScheduledMessage
		var sentAt sql.NullTime
		if err := rows.Scan(&m.ID, &m.CompanyID, &m.InstanceID, &m.RemoteJID, &m.MessageType, &m.Content, &m.MediaURL,
			&m.ScheduledAt, &m.Status, &m.CreatedAt, &sentAt, &m.ErrorMsg); err != nil {
			return nil, err
		}
		if sentAt.Valid {
			m.SentAt = &sentAt.Time
		}
		list = append(list, m)
	}
	return list, nil
}

func (r *SQL) GetByID(ctx context.Context, id, companyID string) (*models.ScheduledMessage, error) {
	query := `SELECT id, company_id, instance_id, remote_jid, message_type, content, media_url, scheduled_at, status, created_at, sent_at, error_msg
		FROM scheduled_messages WHERE id = $1 AND company_id = $2`
	var m models.ScheduledMessage
	var sentAt sql.NullTime
	err := r.db.QueryRowContext(ctx, query, id, companyID).Scan(&m.ID, &m.CompanyID, &m.InstanceID, &m.RemoteJID,
		&m.MessageType, &m.Content, &m.MediaURL, &m.ScheduledAt, &m.Status, &m.CreatedAt, &sentAt, &m.ErrorMsg)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get scheduled_message: %w", err)
	}
	if sentAt.Valid {
		m.SentAt = &sentAt.Time
	}
	return &m, nil
}

func (r *SQL) UpdateStatus(ctx context.Context, id, companyID, status string, sentAt *time.Time, errorMsg string) error {
	query := `UPDATE scheduled_messages SET status = $1, sent_at = $2, error_msg = $3 WHERE id = $4 AND company_id = $5`
	_, err := r.db.ExecContext(ctx, query, status, sentAt, errorMsg, id, companyID)
	if err != nil {
		return fmt.Errorf("update scheduled_message status: %w", err)
	}
	return nil
}

func (r *SQL) Delete(ctx context.Context, id, companyID string) error {
	query := `DELETE FROM scheduled_messages WHERE id = $1 AND company_id = $2`
	res, err := r.db.ExecContext(ctx, query, id, companyID)
	if err != nil {
		return fmt.Errorf("delete scheduled_message: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *SQL) ListPendingUntil(ctx context.Context, until time.Time) ([]models.ScheduledMessage, error) {
	query := `SELECT id, company_id, instance_id, remote_jid, message_type, content, media_url, scheduled_at, status, created_at, sent_at, error_msg
		FROM scheduled_messages WHERE status = 'pending' AND scheduled_at <= $1 ORDER BY scheduled_at ASC`
	rows, err := r.db.QueryContext(ctx, query, until)
	if err != nil {
		return nil, fmt.Errorf("list pending scheduled_messages: %w", err)
	}
	defer rows.Close()
	var list []models.ScheduledMessage
	for rows.Next() {
		var m models.ScheduledMessage
		var sentAt sql.NullTime
		if err := rows.Scan(&m.ID, &m.CompanyID, &m.InstanceID, &m.RemoteJID, &m.MessageType, &m.Content, &m.MediaURL,
			&m.ScheduledAt, &m.Status, &m.CreatedAt, &sentAt, &m.ErrorMsg); err != nil {
			return nil, err
		}
		if sentAt.Valid {
			m.SentAt = &sentAt.Time
		}
		list = append(list, m)
	}
	return list, nil
}
