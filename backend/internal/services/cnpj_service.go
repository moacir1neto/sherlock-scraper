package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
)

// CNPJService handles CNPJ enrichment for leads
type CNPJService struct {
	leadService ports.LeadService
	httpClient  *http.Client
}

// NewCNPJService creates a new CNPJ enrichment service
func NewCNPJService(leadService ports.LeadService) *CNPJService {
	return &CNPJService{
		leadService: leadService,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// CNPJResult represents the result of a CNPJ lookup
type CNPJResult struct {
	CNPJ         string `json:"cnpj"`
	RazaoSocial  string `json:"razao_social"`
	NomeFantasia string `json:"nome_fantasia"`
	Situacao     string `json:"situacao"`
	Email        string `json:"email,omitempty"`
	Telefone     string `json:"telefone,omitempty"`
	Source       string `json:"source"`
}

// EnrichCNPJ looks up the CNPJ for a lead using its company name and address
func (s *CNPJService) EnrichCNPJ(leadID string) (*CNPJResult, error) {
	// 1. Fetch the lead from database
	lead, err := s.leadService.GetLead(nil, leadID)
	if err != nil {
		return nil, fmt.Errorf("lead not found: %w", err)
	}

	if lead.CNPJ != "" {
		log.Printf("ℹ️  Lead %s already has CNPJ: %s", lead.Empresa, lead.CNPJ)
		return &CNPJResult{
			CNPJ:         lead.CNPJ,
			RazaoSocial:  lead.Empresa,
			NomeFantasia: lead.Empresa,
			Source:       "cache",
		}, nil
	}

	log.Printf("🔍 Buscando CNPJ para: %s via Sherlock (Playwright)...", lead.Empresa)

	// 2. Chamar o motor Sherlock (Internal Microservice)
	result, err := s.searchViaSherlock(lead.Empresa)
	if err != nil {
		log.Printf("❌ Sherlock falhou ou não encontrou: %v", err)
		return nil, err // Retorna o erro para o handler tratar (cnpj_not_found)
	}

	// 3. Save CNPJ to database
	lead.CNPJ = result.CNPJ

	// Enriquecimento opcional de campos (Email e Telefone) se vierem do Sherlock e estiverem vazios
	if result.Email != "" && lead.Email == "" {
		lead.Email = result.Email
	}
	if result.Telefone != "" && lead.Telefone == "" {
		lead.Telefone = result.Telefone
	}

	if err := s.leadService.UpdateLead(nil, lead); err != nil {
		log.Printf("⚠️  Erro ao salvar CNPJ no banco: %v", err)
		return result, fmt.Errorf("CNPJ encontrado (%s), mas falhou ao salvar: %w", result.CNPJ, err)
	}

	log.Printf("✅ CNPJ encontrado e salvo: %s → %s", lead.Empresa, result.CNPJ)
	return result, nil
}

// searchViaSherlock consome a Bridge API (Python) rodando no container 'sherlock'
func (s *CNPJService) searchViaSherlock(empresa string) (*CNPJResult, error) {
	apiURL := "http://sherlock:8000/scrape-cnpj"

	payload := map[string]string{"termo": empresa}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	// Struct interna para mapear o retorno do microserviço bridge_api.py
	type SherlockResponse struct {
		Success bool   `json:"success"`
		Error   string `json:"error"`
		Message string `json:"message"`
		Dados   struct {
			CNPJ              string `json:"cnpj"`
			SituacaoCadastral string `json:"situacao_cadastral"`
			Email             string `json:"email"`
			Telefone          string `json:"telefone"`
		} `json:"dados"`
	}

	// Timeout estendido para scraping UI (45s)
	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Post(apiURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("falha na conexão com sherlock: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sherlock retornou status %d", resp.StatusCode)
	}

	var result SherlockResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("falha ao decodificar resposta: %w", err)
	}

	if !result.Success {
		return nil, fmt.Errorf("empresa não encontrada no scraper: %s", result.Message)
	}

	return &CNPJResult{
		CNPJ:         result.Dados.CNPJ,
		RazaoSocial:  empresa,
		NomeFantasia: empresa,
		Situacao:     result.Dados.SituacaoCadastral,
		Email:        result.Dados.Email,
		Telefone:     result.Dados.Telefone,
		Source:       "sherlock",
	}, nil
}

// searchBrasilAPI tries to find CNPJ using BrasilAPI (free)
// Note: BrasilAPI only supports lookup by CNPJ, not by name.
// This function is a placeholder for when a name-search API is available.
func (s *CNPJService) searchBrasilAPI(empresa, city string) (*CNPJResult, error) {
	// BrasilAPI (https://brasilapi.com.br/docs#tag/CNPJ) only supports
	// GET /api/cnpj/v1/{cnpj} — lookup by CNPJ number, not by name.
	// We keep this as a structured placeholder.
	//
	// To use: if you already have a CNPJ number and want to validate/enrich it,
	// call: https://brasilapi.com.br/api/cnpj/v1/{cnpj}
	return nil, fmt.Errorf("BrasilAPI não suporta busca por nome")
}

// searchCasaDosDados tries to search CNPJ by company name using CasaDosDados API
// This is the most common free-ish approach for CNPJ lookup by name
func (s *CNPJService) searchCasaDosDados(empresa, city string) (*CNPJResult, error) {
	// CasaDosDados public search endpoint
	searchURL := "https://api.casadosdados.com.br/v2/public/cnpj/search"

	// Build search payload
	searchTerms := []string{empresa}
	payload := map[string]interface{}{
		"query": map[string]interface{}{
			"termo": searchTerms,
		},
		"range_query": map[string]interface{}{
			"data_abertura": map[string]interface{}{
				"lte": nil,
				"gte": nil,
			},
		},
		"extras": map[string]interface{}{
			"somente_mei":                  false,
			"excluir_mei":                  false,
			"com_email":                    false,
			"incluir_atividade_secundaria": false,
			"com_contato_telefonico":       false,
			"somente_fixo":                 false,
			"somente_celular":              false,
			"somente_matriz":               false,
			"somente_filial":               false,
		},
		"page": 1,
	}

	// If we have a city, add it to narrow results
	if city != "" {
		payload["query"].(map[string]interface{})["municipio"] = []string{city}
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("erro ao montar payload: %w", err)
	}

	req, err := http.NewRequest("POST", searchURL, strings.NewReader(string(payloadBytes)))
	if err != nil {
		return nil, fmt.Errorf("erro ao criar request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "SherlockScraper/1.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("erro na requisição: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("CasaDosDados retornou status %d", resp.StatusCode)
	}

	var apiResp struct {
		Success bool `json:"success"`
		Data    struct {
			Count int `json:"count"`
			CNPJ  []struct {
				CNPJ         string `json:"cnpj"`
				RazaoSocial  string `json:"razao_social"`
				NomeFantasia string `json:"nome_fantasia"`
				Situacao     string `json:"situacao_cadastral"`
				Municipio    string `json:"municipio"`
			} `json:"cnpj"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("erro ao parsear resposta: %w", err)
	}

	if !apiResp.Success || apiResp.Data.Count == 0 || len(apiResp.Data.CNPJ) == 0 {
		return nil, fmt.Errorf("nenhum resultado encontrado")
	}

	// Return the first (best match) result
	best := apiResp.Data.CNPJ[0]
	return &CNPJResult{
		CNPJ:         formatCNPJ(best.CNPJ),
		RazaoSocial:  best.RazaoSocial,
		NomeFantasia: best.NomeFantasia,
		Situacao:     best.Situacao,
		Source:       "casadosdados",
	}, nil
}

// ValidateCNPJ validates and enriches a CNPJ using BrasilAPI
func (s *CNPJService) ValidateCNPJ(cnpj string) (*CNPJResult, error) {
	// Clean CNPJ (remove formatting)
	cleaned := strings.NewReplacer(".", "", "-", "", "/", "").Replace(cnpj)

	apiURL := fmt.Sprintf("https://brasilapi.com.br/api/cnpj/v1/%s", url.PathEscape(cleaned))

	resp, err := s.httpClient.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("erro na requisição BrasilAPI: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("CNPJ %s não encontrado na Receita Federal", cnpj)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("BrasilAPI retornou status %d", resp.StatusCode)
	}

	var apiResp struct {
		CNPJ              string `json:"cnpj"`
		RazaoSocial       string `json:"razao_social"`
		NomeFantasia      string `json:"nome_fantasia"`
		DescricaoSituacao string `json:"descricao_situacao_cadastral"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("erro ao parsear resposta: %w", err)
	}

	return &CNPJResult{
		CNPJ:         formatCNPJ(apiResp.CNPJ),
		RazaoSocial:  apiResp.RazaoSocial,
		NomeFantasia: apiResp.NomeFantasia,
		Situacao:     apiResp.DescricaoSituacao,
		Source:       "brasilapi",
	}, nil
}

// extractCityFromAddress tries to extract city name from a Brazilian address string
func extractCityFromAddress(endereco string) string {
	if endereco == "" {
		return ""
	}

	// Brazilian addresses typically follow: "Rua X, 123 - Bairro, Cidade - UF, CEP"
	// Try to find the city by splitting on common delimiters
	parts := strings.Split(endereco, ",")
	if len(parts) >= 3 {
		// Usually city is in the second-to-last or last part before the state
		for i := len(parts) - 1; i >= 0; i-- {
			part := strings.TrimSpace(parts[i])
			// Skip parts that look like CEP (numbers) or state abbreviations (2 chars)
			if len(part) <= 3 || isNumeric(part) {
				continue
			}
			// Remove state suffix (e.g., "São José - SC" → "São José")
			if dashIdx := strings.LastIndex(part, " - "); dashIdx > 0 {
				city := strings.TrimSpace(part[:dashIdx])
				if len(city) > 2 {
					return city
				}
			}
			// If no dash, this might be the city itself
			if len(part) > 3 && !strings.Contains(part, "-") {
				return part
			}
		}
	}

	return ""
}

// formatCNPJ formats a raw CNPJ string (14 digits) into XX.XXX.XXX/XXXX-XX
func formatCNPJ(raw string) string {
	cleaned := strings.NewReplacer(".", "", "-", "", "/", "", " ", "").Replace(raw)
	if len(cleaned) != 14 {
		return raw // Return as-is if not 14 digits
	}
	return fmt.Sprintf("%s.%s.%s/%s-%s",
		cleaned[0:2], cleaned[2:5], cleaned[5:8], cleaned[8:12], cleaned[12:14])
}

// isNumeric checks if a string contains only digits
func isNumeric(s string) bool {
	cleaned := strings.ReplaceAll(strings.ReplaceAll(s, "-", ""), ".", "")
	for _, c := range cleaned {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}
