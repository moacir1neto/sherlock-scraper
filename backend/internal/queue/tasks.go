package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/database"
	"github.com/hibiken/asynq"
)

const (
	// TaskTypeEnrichLead defines the task identifier for lead enrichment.
	TaskTypeEnrichLead = "enrich:lead"
)

// EnrichLeadPayload contains data for the enrich lead task
type EnrichLeadPayload struct {
	CompanyName string `json:"company_name"`
	LeadID      string `json:"lead_id"`
}

// NewEnrichLeadTask creates a new task to enrich a lead.
func NewEnrichLeadTask(leadID, companyName string) (*asynq.Task, error) {
	payload, err := json.Marshal(EnrichLeadPayload{
		LeadID:      leadID,
		CompanyName: companyName,
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TaskTypeEnrichLead, payload), nil
}

// HandleEnrichLeadTask processes the enrich lead task
func HandleEnrichLeadTask(ctx context.Context, t *asynq.Task) error {
	var payload EnrichLeadPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("json.Unmarshal failed: %v: %w", err, asynq.SkipRetry)
	}

	log.Printf("🔄 Processing task LEAD_ENRICH:%s (%s)", payload.LeadID, payload.CompanyName)

	// A. Buscar o Lead no banco de dados
	var lead domain.Lead
	if err := database.DB.First(&lead, "id = ?", payload.LeadID).Error; err != nil {
		log.Printf("⚠️  Erro ao buscar lead %s: %v", payload.LeadID, err)
		return fmt.Errorf("lead not found: %w", asynq.SkipRetry)
	}

	// B. Atualizar status para ENRIQUECENDO
	lead.Status = domain.StatusEnriquecendo
	if err := database.DB.Save(&lead).Error; err != nil {
		log.Printf("⚠️  Erro ao atualizar status para ENRIQUECENDO: %v", err)
		return err
	}

	log.Printf("📊 Lead '%s' agora está em status ENRIQUECENDO", payload.CompanyName)

	// C. Verificar se o Lead possui um Website
	if lead.Site == "" || !strings.HasPrefix(strings.ToLower(lead.Site), "http") {
		log.Printf("⏭️  Lead '%s' não possui website válido. Pulando enriquecimento web.", payload.CompanyName)

		// Marca como enriquecido mesmo sem dados adicionais
		lead.Status = domain.StatusEnriquecido
		if err := database.DB.Save(&lead).Error; err != nil {
			log.Printf("⚠️  Erro ao marcar lead como ENRIQUECIDO: %v", err)
			return err
		}

		log.Printf("✅ Lead '%s' marcado como ENRIQUECIDO (sem website)", payload.CompanyName)
		return nil
	}

	// D. Fazer requisição HTTP GET para o Website (timeout 10s)
	enrichmentData, err := fetchAndParseWebsite(lead.Site, payload.CompanyName)
	if err != nil {
		log.Printf("⚠️  Erro ao buscar website de '%s': %v", payload.CompanyName, err)

		// Mesmo com erro, marca como enriquecido para não bloquear
		lead.Status = domain.StatusEnriquecido
		if err := database.DB.Save(&lead).Error; err != nil {
			log.Printf("⚠️  Erro ao marcar lead como ENRIQUECIDO após falha: %v", err)
			return err
		}

		log.Printf("⚠️  Lead '%s' marcado como ENRIQUECIDO (website inacessível)", payload.CompanyName)
		return nil
	}

	// E. Atualizar dados do Lead com informações extraídas
	if enrichmentData.Instagram != "" && lead.Instagram == "" {
		lead.Instagram = enrichmentData.Instagram
		log.Printf("📷 Instagram encontrado: %s", enrichmentData.Instagram)
	}

	if enrichmentData.Facebook != "" && lead.Facebook == "" {
		lead.Facebook = enrichmentData.Facebook
		log.Printf("👥 Facebook encontrado: %s", enrichmentData.Facebook)
	}

	lead.TemPixel = enrichmentData.TemPixel
	if enrichmentData.TemPixel {
		log.Printf("🎯 Facebook Pixel detectado!")
	}

	lead.TemGTM = enrichmentData.TemGTM
	if enrichmentData.TemGTM {
		log.Printf("📈 Google Tag Manager detectado!")
	}

	// F. Marcar como ENRIQUECIDO
	lead.Status = domain.StatusEnriquecido

	// G. Salvar no banco de dados
	if err := database.DB.Save(&lead).Error; err != nil {
		log.Printf("⚠️  Erro ao salvar dados enriquecidos: %v", err)
		return err
	}

	log.Printf("✨ Enriquecimento concluído para: %s (Pixel: %v, GTM: %v)",
		payload.CompanyName, lead.TemPixel, lead.TemGTM)

	return nil
}

// fetchAndParseWebsite fetches the website HTML and extracts social media and tracking data
func fetchAndParseWebsite(websiteURL, companyName string) (*EnrichmentData, error) {
	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			// Allow up to 5 redirects
			if len(via) >= 5 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
	}

	// Make GET request
	resp, err := client.Get(websiteURL)
	if err != nil {
		return nil, fmt.Errorf("HTTP GET failed: %w", err)
	}
	defer resp.Body.Close()

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP status %d", resp.StatusCode)
	}

	// Read response body (limit to 1MB to avoid memory issues)
	limitedReader := io.LimitReader(resp.Body, 1024*1024) // 1MB limit
	bodyBytes, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	htmlBody := string(bodyBytes)

	// Extract data using helper functions
	enrichmentData := ExtractSocialAndTracking(htmlBody)

	return enrichmentData, nil
}
