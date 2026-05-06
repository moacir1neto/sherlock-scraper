package csvparser

import (
	"encoding/csv"
	"mime/multipart"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/pkg/phoneutil"
)

// ParseFile parses the uploaded CSV file into a 2D string slice
func ParseFile(file multipart.File) ([][]string, error) {
	reader := csv.NewReader(file)
	// We assume standard comma delimiter, but it could be tweaked if needed
	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}
	return records, nil
}

// MapToLeads converts the CSV rows into a slice of Lead pointers
func MapToLeads(records [][]string, nicho string) []*domain.Lead {
	if len(records) < 2 {
		return nil
	}

	var leads []*domain.Lead
	// Skip header (records[0])
	for i := 1; i < len(records); i++ {
		row := records[i]

		// Fill missing columns if rows are shorter than expected
		// Our CSV format has ~15 columns max
		if len(row) < 15 {
			padding := make([]string, 15-len(row))
			row = append(row, padding...)
		}

		lead := &domain.Lead{
			Empresa:       row[0],
			Rating:        row[1],
			QtdAvaliacoes: row[2],
			ResumoNegocio: row[3],
			Endereco:      row[4],
			Telefone:      phoneutil.StrictClean(row[5]),
			TipoTelefone:  row[6],
			LinkWhatsapp:  row[7],
			Site:          row[8],
			Email:         row[9],
			Instagram:     row[10],
			Facebook:      row[11],
			LinkedIn:      row[12],
			TikTok:        row[13],
			YouTube:       row[14],
			KanbanStatus:  domain.StatusProspeccao,
			Nicho:         nicho,
		}

		if lead.Empresa != "" { // Skip empty companies
			leads = append(leads, lead)
		}
	}

	return leads
}
