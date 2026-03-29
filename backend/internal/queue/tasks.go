package queue

import (
	"bytes"
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

// SherlockCNPJResponse mapeia o retorno do microserviço bridge_api.py
type SherlockCNPJResponse struct {
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

	// --- 🩺 INÍCIO DA CIRURGIA: BUSCA AUTOMÁTICA DE CNPJ ---
	if lead.CNPJ == "" {
		log.Printf("🔍 [Worker] Buscando CNPJ em background para: %s", lead.Empresa)
		
		log.Printf("🔍 [Worker] Solicitando enriquecimento via Sherlock API: %s", lead.Empresa)
		
		cnpjDetail, err := searchCasaDosDadosWorker(lead.Empresa)
		
		if err == nil && cnpjDetail != nil && cnpjDetail.Dados.CNPJ != "" {
			lead.CNPJ = cnpjDetail.Dados.CNPJ
			
			// Enriquecimento opcional de campos se vierem da Casa dos Dados e estiverem vazios
			updates := map[string]interface{}{"cnpj": lead.CNPJ}
			
			if cnpjDetail.Dados.Email != "" && lead.Email == "" {
				lead.Email = cnpjDetail.Dados.Email
				updates["email"] = lead.Email
			}
			
			if cnpjDetail.Dados.Telefone != "" && lead.Telefone == "" {
				lead.Telefone = cnpjDetail.Dados.Telefone
				updates["telefone"] = lead.Telefone
			}

			database.DB.Model(&lead).Updates(updates)
			log.Printf("✅ [Worker] Dados vinculados com sucesso via Sherlock (CNPJ: %s)", lead.CNPJ)
		} else {
			log.Printf("⚠️ [Worker] Sherlock não retornou dados (seguindo com fallback): %v", err)
		}
	}
	// --- 🩺 FIM DA CIRURGIA ---

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

	// F. DEEP ENRICHMENT - Scrape social media profiles
	log.Printf("🕵️  Iniciando Deep Enrichment para: %s", payload.CompanyName)

	// Initialize DeepData structure
	deepData := &DeepDataStructure{}

	// Scrape Instagram if available
	if lead.Instagram != "" && strings.HasPrefix(lead.Instagram, "http") {
		log.Printf("🔍 Extraindo inteligência do Instagram...")
		socialData := ScrapeInstagramProfile(lead.Instagram)

		if socialData.Success {
			deepData.Instagram = &SocialPlatformData{
				Bio:          socialData.Bio,
				LastPostDate: socialData.LastPostDate,
				Posts:        socialData.RecentPosts,
			}
			log.Printf("✨ Deep intelligence extraída do Instagram!")
		} else {
			log.Printf("⚠️  Instagram: %s", socialData.ErrorMessage)
		}
	}

	// Scrape Facebook if available (parallel to Instagram)
	if lead.Facebook != "" && strings.HasPrefix(lead.Facebook, "http") {
		log.Printf("🔍 Extraindo inteligência do Facebook...")
		socialData := ScrapeFacebookPage(lead.Facebook)

		if socialData.Success {
			deepData.Facebook = &SocialPlatformData{
				Bio:          socialData.Bio,
				LastPostDate: socialData.LastPostDate,
				Posts:        socialData.RecentPosts,
			}
			log.Printf("✨ Deep intelligence extraída do Facebook!")
		} else {
			log.Printf("⚠️  Facebook: %s", socialData.ErrorMessage)
		}
	}

	// ═══════════════════════════════════════════════════════════════
	// GOOGLE REVIEWS EXTRACTION
	// ═══════════════════════════════════════════════════════════════
	log.Printf("🔍 Iniciando extração de avaliações do Google para: %s", lead.Empresa)
	googleData, errGoogle := ScrapeGoogleReviews(lead.Empresa)

	if errGoogle != nil {
		log.Printf("⚠️  Aviso: Não foi possível extrair dados do Google: %v", errGoogle)
	} else if googleData != nil {
		deepData.Google = googleData
		log.Printf("✨ Google Reviews extraído com sucesso! (Nota: %s, Avaliações: %s, Comentários: %d)",
			googleData.NotaGeral, googleData.TotalAvaliacoes, len(googleData.ComentariosRecentes))
	}

	// Save DeepData as JSONB
	if deepData.Instagram != nil || deepData.Facebook != nil {
		deepDataJSON, err := json.Marshal(deepData)
		if err != nil {
			log.Printf("⚠️  Erro ao serializar DeepData: %v", err)
		} else {
			lead.DeepData = deepDataJSON
			log.Printf("💾 DeepData salvo em JSONB")
		}
	}

	// G. Marcar como ENRIQUECIDO
	lead.Status = domain.StatusEnriquecido

	// H. Salvar no banco de dados
	if err := database.DB.Save(&lead).Error; err != nil {
		log.Printf("⚠️  Erro ao salvar dados enriquecidos: %v", err)
		return err
	}

	log.Printf("✨ Enriquecimento concluído para: %s (Pixel: %v, GTM: %v, Google Reviews: %v)",
		payload.CompanyName, lead.TemPixel, lead.TemGTM, deepData.Google != nil)

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

// searchCasaDosDadosWorker consome a Bridge API (Python) rodando no container 'sherlock'
func searchCasaDosDadosWorker(empresa string) (*SherlockCNPJResponse, error) {
	apiURL := "http://sherlock:8000/scrape-cnpj"
	
	payload := map[string]string{"termo": empresa}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 45 * time.Second} // Timeout estendido para scraping UI
	resp, err := client.Post(apiURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("falha na conexão com sherlock: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sherlock retornou status %d", resp.StatusCode)
	}

	var result SherlockCNPJResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("falha ao decodificar resposta: %w", err)
	}

	if !result.Success {
		return &result, fmt.Errorf("scraper reportou erro: %s", result.Message)
	}

	return &result, nil
}
