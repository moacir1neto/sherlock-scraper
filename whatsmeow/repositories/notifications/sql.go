package notifications

import (
	"context"
	"database/sql"
	"github.com/google/uuid"
	"github.com/verbeux-ai/whatsmiau/models"
)

type SQLRepository struct {
	db *sql.DB
}

func NewSQL(db *sql.DB) *SQLRepository {
	return &SQLRepository{db: db}
}

func (r *SQLRepository) Create(ctx context.Context, n *models.Notification) error {
	if n.ID == "" {
		n.ID = uuid.New().String()
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO notifications (id, company_id, lead_id, type, payload, status, trace_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		n.ID, n.CompanyID, n.LeadID, n.Type, n.Payload, n.Status, n.TraceID,
	)
	return err
}

func (r *SQLRepository) UpdateStatus(ctx context.Context, id, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE notifications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
		status, id,
	)
	return err
}

func (r *SQLRepository) GetByID(ctx context.Context, id string) (*models.Notification, error) {
	var n models.Notification
	err := r.db.QueryRowContext(ctx,
		`SELECT id, company_id, lead_id, type, payload, status, trace_id, created_at, updated_at
		 FROM notifications WHERE id = $1`,
		id,
	).Scan(&n.ID, &n.CompanyID, &n.LeadID, &n.Type, &n.Payload, &n.Status, &n.TraceID, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &n, nil
}
