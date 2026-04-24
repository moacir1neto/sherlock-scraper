package queue

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/database"
	"gorm.io/datatypes"
)

// ═══════════════════════════════════════════════════════════════
// DossierService — pipeline de deep research de lead
// ═══════════════════════════════════════════════════════════════

// DossierService orquestra as etapas de investigação do pipeline dossier:analyze.
type DossierService struct {
	httpClient *http.Client
}

// NewDossierService cria o serviço com timeout HTTP configurável via env.
func NewDossierService() *DossierService {
	timeout := 30 * time.Second
	if raw := os.Getenv("DOSSIER_SCRAPE_TIMEOUT_SECONDS"); raw != "" {
		if secs, err := strconv.Atoi(raw); err == nil && secs > 0 {
			timeout = time.Duration(secs) * time.Second
		}
	}
	return &DossierService{
		httpClient: &http.Client{Timeout: timeout},
	}
}

// ── Tipos auxiliares ──────────────────────────────────────────────────────────

// dossierAggregated é o estado interno do pipeline após cada etapa.
type dossierAggregated struct {
	Google   *GoogleData         `json:"google,omitempty"`
	Website  *EnrichmentData     `json:"website,omitempty"`
	Instagram *SocialData        `json:"instagram,omitempty"`
	Facebook  *SocialData        `json:"facebook,omitempty"`
}

// ── Helpers de publicação SSE ─────────────────────────────────────────────────

func publishDossierEvent(leadID string, stage domain.DossierStage, status domain.DossierEventStatus, message string) {
	evt := domain.DossierEvent{
		Stage:   stage,
		Status:  status,
		Message: message,
	}
	data, err := json.Marshal(evt)
	if err != nil {
		log.Printf("[DossierService] ⚠️ falha ao serializar evento: %v", err)
		return
	}
	PublishDossierEvent(leadID, string(data))
}

// ── Pipeline principal ────────────────────────────────────────────────────────

// RunPipeline executa todas as etapas de investigação para o lead indicado.
// Cada etapa é tolerante a falha (graceful degradation): um erro parcial não
// aborta o pipeline — apenas registra no evento SSE e continua.
func (s *DossierService) RunPipeline(ctx context.Context, leadID string) error {
	lead, err := s.loadLead(ctx, leadID)
	if err != nil {
		return fmt.Errorf("dossier RunPipeline: lead não encontrado (%s): %w", leadID, err)
	}

	agg := &dossierAggregated{}

	// Etapa 1 — Google Maps / Reviews
	agg.Google = s.investigateMaps(ctx, leadID, lead.Empresa)

	// Etapa 2 — Website
	agg.Website = s.investigateWebsite(ctx, leadID, lead.Site, lead.Empresa)

	// Etapa 3 — Redes sociais
	s.investigateSocial(ctx, leadID, lead, agg)

	// Persistir dados brutos agregados
	if err := s.saveDossierData(ctx, leadID, agg); err != nil {
		log.Printf("[DossierService] ⚠️ falha ao salvar dossier_data (lead=%s): %v", leadID, err)
	}

	// Etapa 4 — Análise LLM
	if err := s.generateAnalysis(ctx, leadID, lead, agg); err != nil {
		publishDossierEvent(leadID, domain.DossierStageLLM, domain.DossierStatusError,
			fmt.Sprintf("Erro na análise LLM: %v", err))
		log.Printf("[DossierService] ⚠️ falha na análise LLM (lead=%s): %v", leadID, err)
		return nil // não propaga — dados brutos já foram salvos
	}

	return nil
}

// ── Etapas de investigação ────────────────────────────────────────────────────

func (s *DossierService) investigateMaps(ctx context.Context, leadID, empresa string) *GoogleData {
	publishDossierEvent(leadID, domain.DossierStageMaps, domain.DossierStatusRunning,
		"Buscando avaliações no Google Maps…")

	data, err := ScrapeGoogleReviews(empresa)
	if err != nil {
		publishDossierEvent(leadID, domain.DossierStageMaps, domain.DossierStatusError,
			fmt.Sprintf("Google Maps indisponível: %v", err))
		return nil
	}

	publishDossierEvent(leadID, domain.DossierStageMaps, domain.DossierStatusDone,
		fmt.Sprintf("Google Maps: nota %s (%s avaliações)", data.NotaGeral, data.TotalAvaliacoes))
	return data
}

func (s *DossierService) investigateWebsite(ctx context.Context, leadID, site, empresa string) *EnrichmentData {
	if site == "" {
		publishDossierEvent(leadID, domain.DossierStageWebsite, domain.DossierStatusDone,
			"Site não informado, etapa pulada.")
		return nil
	}

	publishDossierEvent(leadID, domain.DossierStageWebsite, domain.DossierStatusRunning,
		fmt.Sprintf("Analisando site %s…", site))

	data, err := FetchAndParseWebsite(site, empresa)
	if err != nil {
		publishDossierEvent(leadID, domain.DossierStageWebsite, domain.DossierStatusError,
			fmt.Sprintf("Falha ao analisar site: %v", err))
		return nil
	}

	publishDossierEvent(leadID, domain.DossierStageWebsite, domain.DossierStatusDone,
		"Site analisado — rastreadores e redes sociais detectados.")
	return data
}

func (s *DossierService) investigateSocial(ctx context.Context, leadID string, lead *domain.Lead, agg *dossierAggregated) {
	publishDossierEvent(leadID, domain.DossierStageSocial, domain.DossierStatusRunning,
		"Investigando redes sociais…")

	socialFound := false

	if lead.Instagram != "" {
		data := ScrapeInstagramProfile(lead.Instagram)
		agg.Instagram = data
		if data.Success {
			socialFound = true
		}
	}

	if lead.Facebook != "" {
		data := ScrapeFacebookPage(lead.Facebook)
		agg.Facebook = data
		if data.Success {
			socialFound = true
		}
	}

	if socialFound {
		publishDossierEvent(leadID, domain.DossierStageSocial, domain.DossierStatusDone,
			"Redes sociais investigadas.")
	} else {
		publishDossierEvent(leadID, domain.DossierStageSocial, domain.DossierStatusDone,
			"Redes sociais sem dados disponíveis (URLs ausentes ou bloqueio).")
	}
}

// ── Análise LLM ───────────────────────────────────────────────────────────────

const dossierLLMModel = "gemini-2.5-flash"

// dossierSystemPrompt é o prompt base para a análise de dossier.
const dossierSystemPrompt = `Você é um Closer Especialista Sênior em Inteligência Comercial B2B e Vendas.
Sua missão: analisar dados de um lead e gerar um dossiê de inteligência ULTRA-PERSUASIVO.
O SEU PRODUTO: Criação de sites profissionais de alta conversão, automação de WhatsApp, SEO local e estruturação de presença digital.

REGRAS OBRIGATÓRIAS (PUNIÇÃO SE DESCUMPRIDAS):
1. VERDADE ABSOLUTA: Use APENAS os dados marcados com ✅. NUNCA invente que o lead tem nota 0 ou 0 avaliações se a informação estiver ❌ (ausente). Se estiver ausente, foque na falta de visibilidade.
2. ICEBREAKER (WhatsApp): Seja direto, humano e mostre que você pesquisou a empresa. Cite o NOME da empresa e um DADO REAL (ex: "Vi que vocês têm nota X no Google..."). Provoque curiosidade sem tentar vender na primeira mensagem.
3. PITCH COMERCIAL: Foque na DOR (gap) e mostre o ROI claro do SEU PRODUTO. Mostre como um site profissional e automação vão dobrar as vendas deles. Seja agressivo comercialmente, mas polido.
4. GAP CRÍTICO: Identifique a maior ferida digital deles (ex: usam Facebook como site, não têm Pixel, não têm site, nota baixa, etc).

SCORES DE MATURIDADE:
- 0-3 (Iniciante): Usa Facebook/Instagram como site, sem site próprio, sem tracking.
- 4-6 (Intermediário): Tem site básico, redes ativas, mas sem GTM/Pixel ou SEO forte.
- 7-8 (Avançado): Tem GTM/Pixel, mas falta automação ou prova social robusta.
- 9-10 (Expert): Tracking completo, automação visível, dominância no Google.`

// dossierOutputSchema define o formato JSON esperado da resposta LLM.
const dossierOutputSchema = `{
  "score_maturidade": <number 0-10>,
  "classificacao": "Iniciante|Intermediário|Avançado|Expert",
  "gap_critico": "<1 frase específica, max 120 chars>",
  "perda_estimada_mensal": "<ex: R$ 5.000 - R$ 15.000>",
  "icebreaker_whatsapp": "<2 linhas, max 280 chars, cite dado REAL>",
  "pitch_comercial": "<3-4 linhas, foque em ROI e problema específico>",
  "objecao_prevista": "<objeção mais provável baseada no perfil>",
  "resposta_objecao": "<como contornar a objeção>",
  "probabilidade_fechamento": "Baixa|Média|Alta",
  "proximos_passos": ["<passo 1>", "<passo 2>", "<passo 3>"],
  "resumo_executivo": "<parágrafo de 3-5 linhas com o panorama geral do lead>"
}`

func (s *DossierService) generateAnalysis(ctx context.Context, leadID string, lead *domain.Lead, agg *dossierAggregated) error {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return fmt.Errorf("GEMINI_API_KEY não configurada")
	}

	publishDossierEvent(leadID, domain.DossierStageLLM, domain.DossierStatusRunning,
		"Gerando análise de inteligência comercial…")

	prompt := buildDossierPrompt(lead, agg)

	analysis, err := s.callGemini(ctx, apiKey, prompt)
	if err != nil {
		return err
	}

	if err := s.saveDossierAnalysis(ctx, leadID, analysis); err != nil {
		return fmt.Errorf("salvar dossier_analysis: %w", err)
	}

	publishDossierEvent(leadID, domain.DossierStageLLM, domain.DossierStatusDone,
		"Dossiê de inteligência gerado com sucesso.")
	return nil
}

// buildDossierPrompt monta o prompt completo para a LLM a partir dos dados coletados.
func buildDossierPrompt(lead *domain.Lead, agg *dossierAggregated) string {
	var sb strings.Builder

	sb.WriteString(dossierSystemPrompt)
	sb.WriteString("\n\n## DADOS DO LEAD:\n\n")

	avail := func(label, val string) {
		if val != "" {
			fmt.Fprintf(&sb, "✅ %s: %s\n", label, val)
		} else {
			fmt.Fprintf(&sb, "❌ %s: NÃO DISPONÍVEL\n", label)
		}
	}

	avail("Empresa", lead.Empresa)
	avail("Nicho", lead.Nicho)
	avail("Endereço", lead.Endereco)
	avail("Telefone", lead.Telefone)
	avail("Site", lead.Site)
	avail("E-mail", lead.Email)

	// Google Maps
	sb.WriteString("\n### Google Maps:\n")
	
	// Fallback logic for Google Maps data: prefer live scrape, but fallback to CSV pre-scraped data
	nota := lead.Rating
	avaliacoes := lead.QtdAvaliacoes
	
	if agg.Google != nil && agg.Google.NotaGeral != "" && agg.Google.NotaGeral != "0.0" {
		nota = agg.Google.NotaGeral
		avaliacoes = agg.Google.TotalAvaliacoes
	}
	
	if nota != "" && nota != "-" && nota != "0.0" {
		avail("Nota Google", nota)
		avail("Total de Avaliações", avaliacoes)
		if agg.Google != nil && len(agg.Google.ComentariosRecentes) > 0 {
			sb.WriteString("✅ Comentários recentes:\n")
			for _, c := range agg.Google.ComentariosRecentes {
				fmt.Fprintf(&sb, "  - %s\n", c)
			}
		}
	} else {
		sb.WriteString("❌ Google Maps: SEM AVALIAÇÕES OU NÃO DISPONÍVEL\n")
	}

	// Website
	sb.WriteString("\n### Website:\n")
	if agg.Website != nil {
		if agg.Website.TemPixel {
			sb.WriteString("✅ Facebook Pixel: detectado\n")
		} else {
			sb.WriteString("❌ Facebook Pixel: NÃO detectado\n")
		}
		if agg.Website.TemGTM {
			sb.WriteString("✅ Google Tag Manager: detectado\n")
		} else {
			sb.WriteString("❌ Google Tag Manager: NÃO detectado\n")
		}
		if agg.Website.Instagram != "" {
			avail("Instagram (extraído do site)", agg.Website.Instagram)
		}
		if agg.Website.Facebook != "" {
			avail("Facebook (extraído do site)", agg.Website.Facebook)
		}
	} else {
		sb.WriteString("❌ Website: NÃO ANALISADO\n")
	}

	// Redes sociais
	sb.WriteString("\n### Redes Sociais:\n")
	avail("Instagram (URL)", lead.Instagram)
	avail("Facebook (URL)", lead.Facebook)
	avail("LinkedIn", lead.LinkedIn)
	avail("TikTok", lead.TikTok)
	avail("YouTube", lead.YouTube)

	if agg.Instagram != nil && agg.Instagram.Success {
		avail("Bio Instagram", agg.Instagram.Bio)
	}
	if agg.Facebook != nil && agg.Facebook.Success {
		avail("Bio Facebook", agg.Facebook.Bio)
	}

	sb.WriteString("\n\n## OUTPUT ESPERADO (JSON puro, sem markdown):\n\n")
	sb.WriteString("Retorne APENAS um JSON válido com esta estrutura exata:\n")
	sb.WriteString(dossierOutputSchema)
	sb.WriteString("\n\nIMPORTANTE: Seja ULTRA-ESPECÍFICO. Use dados reais. Genérico = Descartado.")

	return sb.String()
}

// ── Gemini REST API ───────────────────────────────────────────────────────────

type dossierGeminiRequest struct {
	Contents []dossierGeminiContent `json:"contents"`
}

type dossierGeminiContent struct {
	Parts []dossierGeminiPart `json:"parts"`
}

type dossierGeminiPart struct {
	Text string `json:"text"`
}

type dossierGeminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func (s *DossierService) callGemini(ctx context.Context, apiKey, prompt string) (string, error) {
	apiURL := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1/models/%s:generateContent?key=%s",
		dossierLLMModel, apiKey,
	)

	reqBody := dossierGeminiRequest{
		Contents: []dossierGeminiContent{
			{Parts: []dossierGeminiPart{{Text: prompt}}},
		},
	}
	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("http call: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini status %d: %s", resp.StatusCode, string(raw))
	}

	var gemResp dossierGeminiResponse
	if err := json.Unmarshal(raw, &gemResp); err != nil {
		return "", fmt.Errorf("unmarshal response: %w", err)
	}

	if len(gemResp.Candidates) == 0 || len(gemResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("gemini retornou resposta vazia")
	}

	text := gemResp.Candidates[0].Content.Parts[0].Text

	// Limpar marcadores de código se presentes
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start != -1 && end != -1 && end > start {
		text = text[start : end+1]
	}

	return text, nil
}

// ── Persistência ─────────────────────────────────────────────────────────────

func (s *DossierService) loadLead(ctx context.Context, leadID string) (*domain.Lead, error) {
	var lead domain.Lead
	if err := database.DB.WithContext(ctx).First(&lead, "id = ?", leadID).Error; err != nil {
		return nil, err
	}
	return &lead, nil
}

func (s *DossierService) saveDossierData(ctx context.Context, leadID string, agg *dossierAggregated) error {
	raw, err := json.Marshal(agg)
	if err != nil {
		return fmt.Errorf("marshal dossier_data: %w", err)
	}
	return database.DB.WithContext(ctx).
		Model(&domain.Lead{}).
		Where("id = ?", leadID).
		Update("dossier_data", datatypes.JSON(raw)).Error
}

func (s *DossierService) saveDossierAnalysis(ctx context.Context, leadID, analysis string) error {
	return database.DB.WithContext(ctx).
		Model(&domain.Lead{}).
		Where("id = ?", leadID).
		Update("dossier_analysis", analysis).Error
}
