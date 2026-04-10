package ai_settings

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/services"
)

type SQLAISettings struct {
	db *sql.DB
}

func NewSQL() (*SQLAISettings, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLAISettings{db: db}, nil
}

// GetByCompanyID retorna as configurações de IA da empresa.
// Se ainda não houver registro, retorna um objeto com defaults (sem erro).
func (r *SQLAISettings) GetByCompanyID(ctx context.Context, companyID string) (*models.AISettings, error) {
	query := `SELECT company_id, company_name, nicho, oferta, tom_de_voz, updated_at
		FROM company_ai_settings WHERE company_id = $1`

	var s models.AISettings
	err := r.db.QueryRowContext(ctx, query, companyID).Scan(
		&s.CompanyID, &s.CompanyName, &s.Nicho, &s.Oferta, &s.TomDeVoz, &s.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		// Sem configuração ainda — retorna defaults, não erro.
		return &models.AISettings{CompanyID: companyID}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get ai_settings: %w", err)
	}
	return &s, nil
}

// Upsert insere ou atualiza as configurações de IA de uma empresa.
func (r *SQLAISettings) Upsert(ctx context.Context, s *models.AISettings) error {
	s.UpdatedAt = time.Now()

	query := `INSERT INTO company_ai_settings (company_id, company_name, nicho, oferta, tom_de_voz, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (company_id) DO UPDATE SET
			company_name = EXCLUDED.company_name,
			nicho        = EXCLUDED.nicho,
			oferta       = EXCLUDED.oferta,
			tom_de_voz   = EXCLUDED.tom_de_voz,
			updated_at   = EXCLUDED.updated_at`

	if _, err := r.db.ExecContext(ctx, query,
		s.CompanyID, s.CompanyName, s.Nicho, s.Oferta, s.TomDeVoz, s.UpdatedAt,
	); err != nil {
		return fmt.Errorf("upsert ai_settings: %w", err)
	}
	return nil
}
