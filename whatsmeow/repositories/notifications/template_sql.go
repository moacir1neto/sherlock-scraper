package notifications

import (
	"context"
	"database/sql"
	"github.com/google/uuid"
	"github.com/verbeux-ai/whatsmiau/models"
)

type TemplateSQLRepository struct {
	db *sql.DB
}

func NewTemplateSQL(db *sql.DB) *TemplateSQLRepository {
	return &TemplateSQLRepository{db: db}
}

func (r *TemplateSQLRepository) GetByType(ctx context.Context, companyID, eventType string) (*models.NotificationTemplate, error) {
	var t models.NotificationTemplate
	err := r.db.QueryRowContext(ctx,
		`SELECT id, company_id, type, content, version, created_at, updated_at
		 FROM notification_templates WHERE company_id = $1 AND type = $2`,
		companyID, eventType,
	).Scan(&t.ID, &t.CompanyID, &t.Type, &t.Content, &t.Version, &t.CreatedAt, &t.UpdatedAt)
	
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TemplateSQLRepository) Upsert(ctx context.Context, t *models.NotificationTemplate) error {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	
	// Postgres ON CONFLICT ou SQLite INSERT OR REPLACE simplificado
	query := `
		INSERT INTO notification_templates (id, company_id, type, content, version, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (company_id, type) DO UPDATE SET
			content = EXCLUDED.content,
			version = notification_templates.version + 1,
			updated_at = CURRENT_TIMESTAMP
	`
	// Fallback para SQLite se necessário (ajustar via env se for rigoroso, 
	// mas aqui usamos a lógica de Postgres por ser o padrão prod)
	
	_, err := r.db.ExecContext(ctx, query, t.ID, t.CompanyID, t.Type, t.Content, t.Version)
	return err
}
