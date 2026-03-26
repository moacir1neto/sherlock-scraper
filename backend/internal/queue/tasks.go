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
	"github.com/playwright-community/playwright-go"
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

	// --- 🩺 INÍCIO DA CIRURGIA: BUSCA AUTOMÁTICA DE CNPJ ---
	if lead.CNPJ == "" {
		log.Printf("🔍 [Worker] Buscando CNPJ em background para: %s", lead.Empresa)
		
		cnpjEncontrado, err := searchCasaDosDadosWorker(lead.Empresa)
		
		if err == nil && cnpjEncontrado != "" {
			lead.CNPJ = cnpjEncontrado
			// Atualiza apenas o campo CNPJ para não sobrescrever outros dados
			database.DB.Model(&lead).Update("cnpj", lead.CNPJ)
			log.Printf("✅ [Worker] CNPJ %s vinculado com sucesso à %s!", lead.CNPJ, lead.Empresa)
		} else {
			log.Printf("⚠️ [Worker] CNPJ não encontrado (seguindo com a raspagem normal): %v", err)
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

// searchCasaDosDadosWorker busca CNPJ via Casa dos Dados usando Playwright para bypass do Cloudflare.
func searchCasaDosDadosWorker(empresa string) (string, error) {
	log.Printf("🌐 [CasaDosDados] Iniciando busca Playwright para: %s", empresa)

	// Instalar driver do Playwright (idempotente, não reinstala se já existe)
	if err := playwright.Install(&playwright.RunOptions{
		SkipInstallBrowsers: true,
	}); err != nil {
		log.Printf("⚠️  Aviso: Falha ao instalar driver do Playwright: %v", err)
	}

	// Iniciar Playwright
	pw, err := playwright.Run()
	if err != nil {
		return "", fmt.Errorf("falha ao iniciar Playwright: %w", err)
	}
	defer pw.Stop()

	// Lançar Chromium headless
	browser, err := pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless:       playwright.Bool(true),
		ExecutablePath: playwright.String("/usr/bin/chromium-browser"),
		Args: []string{
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage",
			"--disable-gpu",
		},
	})
	if err != nil {
		return "", fmt.Errorf("falha ao lançar navegador: %w", err)
	}
	defer browser.Close()

	// Criar contexto com User-Agent moderno para parecer navegador real
	browserCtx, err := browser.NewContext(playwright.BrowserNewContextOptions{
    UserAgent: playwright.String("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"),
    Viewport: &playwright.Size{
        Width:  1920,
        Height: 1080,
    },
    Locale: playwright.String("pt-BR"),
})
	if err != nil {
		return "", fmt.Errorf("falha ao criar contexto do navegador: %w", err)
	}
	defer browserCtx.Close()

	page, err := browserCtx.NewPage()
	if err != nil {
		return "", fmt.Errorf("falha ao criar página: %w", err)
	}
	defer page.Close()

	// 1. Navegar até o site principal para passar pelo challenge do Cloudflare
	if _, err := page.Goto("https://casadosdados.com.br", playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateDomcontentloaded,
		Timeout:   playwright.Float(30000),
	}); err != nil {
		return "", fmt.Errorf("falha ao acessar casadosdados.com.br: %w", err)
	}

	// Aguardar o Cloudflare resolver o challenge
	time.Sleep(5 * time.Second)

	// 2. Executar a chamada à API de dentro do contexto do navegador (herda cookies do Cloudflare)
	jsPayload := fmt.Sprintf(`JSON.stringify({
		"query": { "termo": [%q] },
		"range_query": { "data_abertura": { "lte": null, "gte": null } },
		"extras": {
			"somente_mei": false, "excluir_mei": false, "com_email": false,
			"incluir_atividade_secundaria": false, "com_contato_telefonico": false,
			"somente_fixo": false, "somente_celular": false,
			"somente_matriz": false, "somente_filial": false
		},
		"page": 1
	})`, empresa)

	apiResult, err := page.Evaluate(fmt.Sprintf(`async () => {
		try {
			const body = %s;
			const resp = await fetch("https://api.casadosdados.com.br/v2/public/cnpj/search", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: body
			});
			if (resp.status === 404) return { error: "not_found" };
			if (!resp.ok) throw new Error("HTTP " + resp.status);
			return await resp.json();
		} catch (e) {
			return { error: e.message };
		}
	}`, jsPayload))
	if err != nil {
		return "", fmt.Errorf("falha crítica na execução do script: %w", err)
	}

	// 2.2 Verificar se o script retornou um erro tratado
	resultMap, ok := apiResult.(map[string]interface{})
	if ok {
		if errorMsg, hasError := resultMap["error"]; hasError {
			return "", fmt.Errorf("CasaDosDados reportou erro: %v", errorMsg)
		}
	}

	// 3. Parsear o resultado retornado pelo JavaScript
	resultJSON, err := json.Marshal(apiResult)
	if err != nil {
		return "", fmt.Errorf("falha ao serializar resultado: %w", err)
	}

	var apiResp struct {
		Success bool `json:"success"`
		Data    struct {
			Count int `json:"count"`
			CNPJ  []struct {
				CNPJ string `json:"cnpj"`
			} `json:"cnpj"`
		} `json:"data"`
	}

	if err := json.Unmarshal(resultJSON, &apiResp); err != nil {
		return "", fmt.Errorf("falha ao decodificar resposta: %w", err)
	}

	if !apiResp.Success || apiResp.Data.Count == 0 || len(apiResp.Data.CNPJ) == 0 {
		return "", fmt.Errorf("nenhum resultado encontrado para '%s'", empresa)
	}

	// 4. Formatar e retornar o primeiro CNPJ
	rawCnpj := apiResp.Data.CNPJ[0].CNPJ
	cleaned := strings.NewReplacer(".", "", "-", "", "/", "").Replace(rawCnpj)
	if len(cleaned) == 14 {
		return fmt.Sprintf("%s.%s.%s/%s-%s", cleaned[0:2], cleaned[2:5], cleaned[5:8], cleaned[8:12], cleaned[12:14]), nil
	}

	return rawCnpj, nil
}
