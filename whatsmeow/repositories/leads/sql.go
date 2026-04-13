package leads

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/services"
)

var _ interfaces.LeadRepository = (*SQLLead)(nil)

var ErrNotFound = errors.New("lead not found")

// allCols é a lista canônica de colunas para SELECT — usada em todas as queries.
const allCols = `id, company_id, COALESCE(scrape_id,'') as scrape_id, source_id,
	name, phone, address, website, email, rating, reviews,
	kanban_status, enrichment_status, notes, estimated_value, tags,
	COALESCE(nicho,'') as nicho, COALESCE(resumo,'') as resumo,
	COALESCE(tipo_telefone,'') as tipo_telefone, COALESCE(link_whatsapp,'') as link_whatsapp,
	COALESCE(instagram,'') as instagram, COALESCE(facebook,'') as facebook,
	COALESCE(linkedin,'') as linkedin, COALESCE(tiktok,'') as tiktok,
	COALESCE(youtube,'') as youtube, COALESCE(cnpj,'') as cnpj,
	COALESCE(ai_analysis,'') as ai_analysis,
	created_at, updated_at`

func scanLead(s interface {
	Scan(...any) error
}, l *models.Lead) error {
	return s.Scan(
		&l.ID, &l.CompanyID, &l.ScrapeID, &l.SourceID,
		&l.Name, &l.Phone, &l.Address, &l.Website, &l.Email,
		&l.Rating, &l.Reviews,
		&l.KanbanStatus, &l.EnrichmentStatus, &l.Notes,
		&l.EstimatedValue, &l.Tags,
		&l.Nicho, &l.Resumo, &l.TipoTelefone, &l.LinkWhatsapp,
		&l.Instagram, &l.Facebook, &l.LinkedIn, &l.TikTok,
		&l.YouTube, &l.CNPJ, &l.AIAnalysis,
		&l.CreatedAt, &l.UpdatedAt,
	)
}

type SQLLead struct {
	db *sql.DB
}

func NewSQL() (*SQLLead, error) {
	db, err := services.DB()
	if err != nil {
		return nil, err
	}
	return &SQLLead{db: db}, nil
}

func (r *SQLLead) Create(ctx context.Context, lead *models.Lead) error {
	if lead.ID == "" {
		lead.ID = uuid.New().String()
	}
	now := time.Now()
	if lead.CreatedAt.IsZero() {
		lead.CreatedAt = now
	}
	lead.UpdatedAt = now

	query := `INSERT INTO leads
		(id, company_id, scrape_id, source_id, name, phone, address, website, email, rating, reviews,
		 kanban_status, enrichment_status, notes, estimated_value, tags,
		 nicho, resumo, tipo_telefone, link_whatsapp, instagram, facebook, linkedin, tiktok, youtube, cnpj,
		 created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`
	_, err := r.db.ExecContext(ctx, query,
		lead.ID, lead.CompanyID, lead.ScrapeID, lead.SourceID,
		lead.Name, lead.Phone, lead.Address, lead.Website, lead.Email, lead.Rating, lead.Reviews,
		lead.KanbanStatus, lead.EnrichmentStatus, lead.Notes, lead.EstimatedValue, lead.Tags,
		lead.Nicho, lead.Resumo, lead.TipoTelefone, lead.LinkWhatsapp,
		lead.Instagram, lead.Facebook, lead.LinkedIn, lead.TikTok, lead.YouTube, lead.CNPJ,
		lead.CreatedAt, lead.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("create lead: %w", err)
	}
	return nil
}

func (r *SQLLead) BulkCreate(ctx context.Context, leads []*models.Lead) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck

	now := time.Now()
	query := `INSERT INTO leads
		(id, company_id, scrape_id, source_id, name, phone, address, website, email, rating, reviews,
		 kanban_status, enrichment_status, notes, estimated_value, tags,
		 nicho, resumo, tipo_telefone, link_whatsapp, instagram, facebook, linkedin, tiktok, youtube, cnpj,
		 created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`

	for _, lead := range leads {
		if lead.ID == "" {
			lead.ID = uuid.New().String()
		}
		lead.CreatedAt = now
		lead.UpdatedAt = now

		if _, err := tx.ExecContext(ctx, query,
			lead.ID, lead.CompanyID, lead.ScrapeID, lead.SourceID,
			lead.Name, lead.Phone, lead.Address, lead.Website, lead.Email, lead.Rating, lead.Reviews,
			lead.KanbanStatus, lead.EnrichmentStatus, lead.Notes, lead.EstimatedValue, lead.Tags,
			lead.Nicho, lead.Resumo, lead.TipoTelefone, lead.LinkWhatsapp,
			lead.Instagram, lead.Facebook, lead.LinkedIn, lead.TikTok, lead.YouTube, lead.CNPJ,
			lead.CreatedAt, lead.UpdatedAt,
		); err != nil {
			return fmt.Errorf("bulk create lead %q: %w", lead.Name, err)
		}
	}

	return tx.Commit()
}

func (r *SQLLead) Update(ctx context.Context, lead *models.Lead) error {
	lead.UpdatedAt = time.Now()
	query := `UPDATE leads
		SET name=$1, phone=$2, address=$3, website=$4, email=$5,
		    kanban_status=$6, enrichment_status=$7, notes=$8,
		    estimated_value=$9, tags=$10, link_whatsapp=$11, updated_at=$12
		WHERE id=$13 AND company_id=$14`
	res, err := r.db.ExecContext(ctx, query,
		lead.Name, lead.Phone, lead.Address, lead.Website, lead.Email,
		lead.KanbanStatus, lead.EnrichmentStatus, lead.Notes,
		lead.EstimatedValue, lead.Tags, lead.LinkWhatsapp, lead.UpdatedAt,
		lead.ID, lead.CompanyID,
	)
	if err != nil {
		return fmt.Errorf("update lead: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *SQLLead) UpdateStatus(ctx context.Context, id, companyID, kanbanStatus string) error {
	query := `UPDATE leads SET kanban_status=$1, updated_at=$2 WHERE id=$3 AND company_id=$4`
	res, err := r.db.ExecContext(ctx, query, kanbanStatus, time.Now(), id, companyID)
	if err != nil {
		return fmt.Errorf("update lead status: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *SQLLead) UpdateAIAnalysis(ctx context.Context, id, companyID, aiAnalysis string) error {
	query := `UPDATE leads SET ai_analysis=$1, updated_at=$2 WHERE id=$3 AND company_id=$4`
	res, err := r.db.ExecContext(ctx, query, aiAnalysis, time.Now(), id, companyID)
	if err != nil {
		return fmt.Errorf("update ai analysis: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *SQLLead) GetByID(ctx context.Context, id, companyID string) (*models.Lead, error) {
	query := fmt.Sprintf(`SELECT %s FROM leads WHERE id=$1 AND company_id=$2`, allCols)
	var l models.Lead
	if err := scanLead(r.db.QueryRowContext(ctx, query, id, companyID), &l); err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get lead: %w", err)
	}
	return &l, nil
}

func (r *SQLLead) ListByCompanyID(ctx context.Context, companyID string, limit, offset int, status string) ([]models.Lead, int, error) {
	var (
		countQuery string
		listQuery  string
		args       []any
		countArgs  []any
		paramIdx   = 1
	)

	selectCols := fmt.Sprintf(`SELECT %s FROM leads`, allCols)

	if companyID != "" {
		countQuery = fmt.Sprintf(`SELECT COUNT(*) FROM leads WHERE company_id=$%d`, paramIdx)
		listQuery = fmt.Sprintf(`%s WHERE company_id=$%d`, selectCols, paramIdx)
		args = []any{companyID}
		countArgs = []any{companyID}
		paramIdx++
	} else {
		countQuery = `SELECT COUNT(*) FROM leads`
		listQuery = selectCols
		args = []any{}
		countArgs = []any{}
	}

	if status != "" {
		separator := " WHERE"
		if companyID != "" {
			separator = " AND"
		}
		listQuery += fmt.Sprintf("%s kanban_status=$%d", separator, paramIdx)
		countQuery += fmt.Sprintf("%s kanban_status=$%d", separator, paramIdx)
		args = append(args, status)
		countArgs = append(countArgs, status)
		paramIdx++ //nolint:ineffassign
	}

	listQuery += " ORDER BY created_at DESC"
	if limit > 0 {
		listQuery += fmt.Sprintf(" LIMIT %d OFFSET %d", limit, offset)
	}

	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count leads: %w", err)
	}

	rows, err := r.db.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list leads: %w", err)
	}
	defer rows.Close()

	var list []models.Lead
	for rows.Next() {
		var l models.Lead
		if err := scanLead(rows, &l); err != nil {
			return nil, 0, err
		}
		list = append(list, l)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("rows iteration: %w", err)
	}
	return list, total, nil
}

func (r *SQLLead) ListByScrapeID(ctx context.Context, scrapeID, companyID string) ([]models.Lead, error) {
	query := fmt.Sprintf(`SELECT %s FROM leads WHERE scrape_id=$1 AND company_id=$2 ORDER BY created_at ASC`, allCols)
	rows, err := r.db.QueryContext(ctx, query, scrapeID, companyID)
	if err != nil {
		return nil, fmt.Errorf("list leads by scrape: %w", err)
	}
	defer rows.Close()

	var list []models.Lead
	for rows.Next() {
		var l models.Lead
		if err := scanLead(rows, &l); err != nil {
			return nil, err
		}
		list = append(list, l)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}
	return list, nil
}

func (r *SQLLead) Delete(ctx context.Context, id, companyID string) error {
	query := `DELETE FROM leads WHERE id=$1 AND company_id=$2`
	res, err := r.db.ExecContext(ctx, query, id, companyID)
	if err != nil {
		return fmt.Errorf("delete lead: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// FindByName busca o lead mais recente cujo nome contenha a string fornecida.
// Usa ILIKE para match case-insensitive. Retorna nil sem erro se não encontrado.
func (r *SQLLead) FindByName(ctx context.Context, companyID string, name string) (*models.Lead, error) {
	if name == "" {
		return nil, nil
	}

	query := fmt.Sprintf(`SELECT %s FROM leads
		WHERE company_id=$1
		  AND name ILIKE $2
		ORDER BY created_at DESC
		LIMIT 1`,
		allCols,
	)

	var l models.Lead
	err := scanLead(r.db.QueryRowContext(ctx, query, companyID, "%"+name+"%"), &l)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("find lead by name: %w", err)
	}
	return &l, nil
}

// FindByPhone busca o lead mais recente cujo telefone normalizado (só dígitos)
// case com qualquer uma das variantes fornecidas.
//
// Usa regexp_replace para normalizar o campo phone do banco na hora da query,
// eliminando qualquer formatação armazenada (ex: "(48) 9 9999-9999").
// Retorna nil sem erro se nenhum lead for encontrado.
func (r *SQLLead) FindByPhone(ctx context.Context, companyID string, variants []string) (*models.Lead, error) {
	if len(variants) == 0 {
		return nil, nil
	}

	// Constrói placeholders: $2, $3, $4, ...
	placeholders := make([]string, len(variants))
	args := make([]interface{}, 0, len(variants)+1)
	args = append(args, companyID)
	for i, v := range variants {
		placeholders[i] = fmt.Sprintf("$%d", i+2)
		args = append(args, v)
	}

	query := fmt.Sprintf(`SELECT %s FROM leads
		WHERE company_id=$1
		  AND regexp_replace(phone, '[^0-9]', '', 'g') IN (%s)
		ORDER BY created_at DESC
		LIMIT 1`,
		allCols,
		strings.Join(placeholders, ","),
	)

	var l models.Lead
	err := scanLead(r.db.QueryRowContext(ctx, query, args...), &l)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("find lead by phone: %w", err)
	}
	return &l, nil
}
