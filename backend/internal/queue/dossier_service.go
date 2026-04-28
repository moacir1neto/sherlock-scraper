package queue

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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
	"github.com/google/uuid"
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
	Google    *GoogleData      `json:"google,omitempty"`
	Website   *WebsiteData     `json:"website,omitempty"`
	Instagram *SocialData      `json:"instagram,omitempty"`
	Facebook  *SocialData      `json:"facebook,omitempty"`

	// Dados pré-enriquecidos: carregados do DeepData do banco antes da análise LLM.
	Insights *BusinessInsights `json:"insights,omitempty"`
	RawText  string            `json:"-"`
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
	s.loadPreEnrichedData(lead, agg)

	// Auto-enrichment: se Insights ainda não existem, rodar enrichment automaticamente.
	if agg.Insights == nil {
		log.Printf("[DossierService] Insights ausentes para lead=%s — iniciando enrichment automático", leadID)
		publishDossierEvent(leadID, domain.DossierStageEnrich, domain.DossierStatusRunning,
			"Dados insuficientes — iniciando enrichment automático...")

		// Lock atômico: só avança se conseguir setar ENRIQUECENDO atomicamente.
		// Se RowsAffected == 0, outro processo já detém o lock.
		res := database.DB.Exec(
			"UPDATE leads SET status = 'ENRIQUECENDO' WHERE id = ? AND status != 'ENRIQUECENDO'",
			leadID,
		)
		if res.Error != nil {
			return fmt.Errorf("falha ao adquirir lock de enrichment: %w", res.Error)
		}
		if res.RowsAffected == 0 {
			log.Printf("[DossierService] lead=%s já está em ENRIQUECENDO — aguarde e tente novamente", leadID)
			publishDossierEvent(leadID, domain.DossierStageEnrich, domain.DossierStatusError,
				"Enrichment já em andamento, aguarde e tente novamente.")
			return nil
		}

		// Timeout híbrido: 60s síncronos; se estourar, delega para background.
		enrichCtx, enrichCancel := context.WithTimeout(ctx, 60*time.Second)
		enrichErr := performLeadEnrichment(enrichCtx, lead)
		enrichCancel()

		if enrichErr != nil {
			if errors.Is(enrichCtx.Err(), context.DeadlineExceeded) {
				log.Printf("[DossierService] lead=%s: enrichment não concluiu em 60s — continuando em background", leadID)
				publishDossierEvent(leadID, domain.DossierStageEnrich, domain.DossierStatusRunning,
					"Enrichment demorou mais que o esperado — continuando em background. Tente o dossiê novamente em alguns minutos.")
				go func() {
					bgErr := performLeadEnrichment(context.Background(), lead)
					if bgErr != nil {
						log.Printf("[DossierService] ⚠️ enrichment background falhou lead=%s: %v", leadID, bgErr)
					} else {
						log.Printf("[DossierService] ✅ enrichment background concluído lead=%s", leadID)
					}
				}()
				return nil
			}
			// Erro real (não timeout): marcar falha e abortar
			log.Printf("[DossierService] Enrichment automático falhou para lead=%s: %v", leadID, enrichErr)
			database.DB.Model(&domain.Lead{}).Where("id = ?", leadID).
				Update("status", domain.StatusEnrichmentFailed)
			publishDossierEvent(leadID, domain.DossierStageEnrich, domain.DossierStatusError,
				"Enrichment automático falhou: "+enrichErr.Error())
			return enrichErr
		}

		log.Printf("[DossierService] ✅ Enrichment concluído para lead=%s — recarregando dados", leadID)

		if err := database.DB.First(lead, "id = ?", leadID).Error; err != nil {
			return fmt.Errorf("falha ao recarregar lead após enrichment: %w", err)
		}
		s.loadPreEnrichedData(lead, agg)

		// Validar que Insights foram populados
		if agg.Insights == nil {
			log.Printf("[DossierService] ⚠️ lead=%s: enrichment concluído mas Insights ainda nil — lead_id=%s", leadID, leadID)
			database.DB.Model(&domain.Lead{}).Where("id = ?", leadID).
				Update("status", domain.StatusEnrichmentFailed)
			publishDossierEvent(leadID, domain.DossierStageEnrich, domain.DossierStatusError,
				"Enrichment concluído mas não gerou dados suficientes. Verifique se o lead possui site.")
			return fmt.Errorf("insights ausentes após enrichment para lead=%s", leadID)
		}
	}

	// Etapa 1 — Google Maps / Reviews (só re-scrapa se não veio do DeepData)
	if agg.Google == nil {
		publishDossierEvent(leadID, domain.DossierStageMaps, domain.DossierStatusRunning, "Coletando dados externos...")
		agg.Google = s.investigateMaps(ctx, leadID, lead.Empresa)
	} else {
		publishDossierEvent(leadID, domain.DossierStageMaps, domain.DossierStatusDone,
			fmt.Sprintf("Google Maps: nota %s (%s avaliações) — dados do enriquecimento", agg.Google.NotaGeral, agg.Google.TotalAvaliacoes))
	}

	// Etapa 2 — Website (só re-scrapa se não veio do DeepData)
	if agg.Website == nil {
		agg.Website = s.investigateWebsite(ctx, leadID, lead.Site, lead.Empresa)
	}

	if agg.Website != nil && agg.Website.RawText != "" && agg.RawText == "" {
		if len(agg.Website.RawText) > 800 {
			agg.RawText = agg.Website.RawText[:800]
		} else {
			agg.RawText = agg.Website.RawText
		}
	}

	// Etapa 3 — Redes sociais
	s.investigateSocial(ctx, leadID, lead, agg)

	if err := s.saveDossierData(ctx, leadID, agg); err != nil {
		log.Printf("[DossierService] ⚠️ falha ao salvar dossier_data (lead=%s): %v", leadID, err)
	}

	logDossierDiagnostic(leadID, lead, agg)

	if agg.Insights == nil {
		log.Printf("[DossierService] 🚨 lead=%s sem Insights — enrichment não executado ou falhou. Abortando dossiê.", leadID)
		publishDossierEvent(leadID, domain.DossierStageLLM, domain.DossierStatusError,
			"Lead sem insights — enrichment não executado ou falhou. Execute o enriquecimento antes de gerar o dossiê.")
		return fmt.Errorf("lead sem insights — enrichment não executado ou falhou (lead=%s)", leadID)
	}

	// Etapa 4 — Análise LLM
	publishDossierEvent(leadID, domain.DossierStageLLM, domain.DossierStatusRunning, "Analisando com inteligência artificial...")
	if err := s.generateAnalysis(ctx, leadID, lead, agg); err != nil {
		publishDossierEvent(leadID, domain.DossierStageLLM, domain.DossierStatusError,
			fmt.Sprintf("Erro na análise LLM: %v", err))
		log.Printf("[DossierService] ⚠️ falha na análise LLM (lead=%s): %v", leadID, err)
		return nil
	}

	publishDossierEvent(leadID, domain.DossierStageLLM, domain.DossierStatusDone, "Dossiê gerado com sucesso.")
	return nil
}

// logDossierDiagnostic imprime no log um raio-X completo dos dados disponíveis
// antes de acionar o LLM, permitindo identificar exatamente o que a IA recebe.
func logDossierDiagnostic(leadID string, lead *domain.Lead, agg *dossierAggregated) {
	log.Printf("[Dossier Diagnóstico] ══════════════ PRÉ-LLM (lead=%s | %s) ══════════════", leadID, lead.Empresa)

	// Score
	log.Printf("[Dossier Diagnóstico] Score de Oportunidade: %d/100", lead.Score)

	// BusinessInsights
	if agg.Insights == nil {
		log.Printf("[Dossier Diagnóstico] ❌ BusinessInsights: AUSENTE — dossiê será genérico")
	} else {
		log.Printf("[Dossier Diagnóstico] ✅ BusinessInsights: PRESENTE")

		if agg.Insights.BusinessType != "" {
			log.Printf("[Dossier Diagnóstico]   ✅ business_type   : %s", agg.Insights.BusinessType)
		} else {
			log.Printf("[Dossier Diagnóstico]   ❌ business_type   : VAZIO")
		}

		if len(agg.Insights.Services) > 0 {
			log.Printf("[Dossier Diagnóstico]   ✅ services (%d)   : %s", len(agg.Insights.Services), strings.Join(agg.Insights.Services, ", "))
		} else {
			log.Printf("[Dossier Diagnóstico]   ❌ services        : VAZIO")
		}

		if agg.Insights.MarketingLevel != "" {
			log.Printf("[Dossier Diagnóstico]   ✅ marketing_level : %s", agg.Insights.MarketingLevel)
		} else {
			log.Printf("[Dossier Diagnóstico]   ❌ marketing_level : VAZIO")
		}

		if agg.Insights.TargetAudience != "" {
			log.Printf("[Dossier Diagnóstico]   ✅ target_audience : %s", agg.Insights.TargetAudience)
		} else {
			log.Printf("[Dossier Diagnóstico]   ❌ target_audience : VAZIO")
		}

		log.Printf("[Dossier Diagnóstico]   ✅ has_whatsapp    : %v", agg.Insights.HasWhatsApp)
	}

	// RawText
	if agg.RawText == "" {
		log.Printf("[Dossier Diagnóstico] ❌ RawText: AUSENTE")
	} else {
		preview := agg.RawText
		if len(preview) > 120 {
			preview = preview[:120] + "..."
		}
		log.Printf("[Dossier Diagnóstico] ✅ RawText (%d chars): %s", len(agg.RawText), preview)
	}

	// Google Maps
	nota := lead.Rating
	if agg.Google != nil && agg.Google.NotaGeral != "" && agg.Google.NotaGeral != "0.0" {
		nota = agg.Google.NotaGeral
	}
	if nota != "" && nota != "-" && nota != "0.0" {
		log.Printf("[Dossier Diagnóstico] ✅ Google Maps nota : %s", nota)
	} else {
		log.Printf("[Dossier Diagnóstico] ❌ Google Maps nota : SEM AVALIAÇÕES")
	}

	log.Printf("[Dossier Diagnóstico] ════════════════════════════════════════════════════════")
}

// loadPreEnrichedData extrai BusinessInsights e RawText do DeepData já persistido
// pelo pipeline de enriquecimento (HandleEnrichLeadTask). Elimina a desconexão
// entre enriquecimento e dossiê, evitando reprocessar dados já disponíveis.
func (s *DossierService) loadPreEnrichedData(lead *domain.Lead, agg *dossierAggregated) {
	if len(lead.DeepData) == 0 {
		log.Printf("[DossierService] ℹ️ DeepData ausente para lead=%s — dossiê usará apenas dados brutos", lead.ID)
		return
	}

	var deepData DeepDataStructure
	if err := json.Unmarshal(lead.DeepData, &deepData); err != nil {
		log.Printf("[DossierService] ⚠️ falha ao deserializar DeepData (lead=%s): %v", lead.ID, err)
		return
	}

	if deepData.Insights != nil {
		agg.Insights = deepData.Insights
		log.Printf("[DossierService] ✅ BusinessInsights carregados (tipo=%q, marketing=%q, serviços=%d, público=%q)",
			deepData.Insights.BusinessType,
			deepData.Insights.MarketingLevel,
			len(deepData.Insights.Services),
			deepData.Insights.TargetAudience,
		)
	} else {
		log.Printf("[DossierService] ⚠️ DeepData presente mas Insights é nil — site pode não ter sido crawleado")
	}

	if deepData.Google != nil {
		agg.Google = deepData.Google
		log.Printf("[DossierService] ✅ GoogleData carregado do DeepData (nota=%q, avaliações=%q)",
			deepData.Google.NotaGeral,
			deepData.Google.TotalAvaliacoes,
		)
	}

	log.Println("Loaded Insights:", agg.Insights)
	log.Println("Loaded GoogleData:", agg.Google)

	// Construir RawText contextual a partir de posts das redes sociais já capturados
	if deepData.Instagram != nil && len(deepData.Instagram.Posts) > 0 {
		limit := min(3, len(deepData.Instagram.Posts))
		agg.RawText += "Posts Instagram: " + strings.Join(deepData.Instagram.Posts[:limit], " | ") + "\n"
	}
	if deepData.Facebook != nil && len(deepData.Facebook.Posts) > 0 {
		limit := min(3, len(deepData.Facebook.Posts))
		agg.RawText += "Posts Facebook: " + strings.Join(deepData.Facebook.Posts[:limit], " | ") + "\n"
	}
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

func (s *DossierService) investigateWebsite(ctx context.Context, leadID, site, empresa string) *WebsiteData {
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

// dossierSystemPrompt força uso explícito de dados reais por seção,
// proíbe linguagem vaga e define comportamentos condicionais para
// marketing_level e ausência de avaliações.
const dossierSystemPrompt = `Você é um Closer Especialista Sênior em Inteligência Comercial B2B e Vendas.
Sua missão: gerar um dossiê de inteligência comercial CIRÚRGICO com base nos dados estruturados fornecidos.
O SEU PRODUTO: Sites profissionais de alta conversão, automação de WhatsApp, SEO local e presença digital.

═══ REGRAS DE OURO — DESCUMPRIR = DOSSIÊ INVÁLIDO ═══

[REGRA 1 — IDENTIDADE OBRIGATÓRIA]
Cada seção gerada (gap_critico, icebreaker_whatsapp, pitch_comercial) DEVE mencionar:
  • O tipo de negócio exato (ex: "academia", "clínica odontológica", "restaurante")
  • OU ao menos 1 serviço da lista "Serviços/Produtos oferecidos"
Nunca use termos vagos. SUBSTITUIÇÃO OBRIGATÓRIA:
  ❌ PROIBIDO           → ✅ CORRETO
  "sua empresa"         → "sua academia" / "sua clínica" / "seu restaurante"
  "seu negócio"         → "seu escritório de advocacia" / "sua loja de calçados"
  "sua marca"           → use o nome real da empresa ou o tipo de negócio
  "você atua no setor"  → "você oferece [serviço específico]"

[REGRA 2 — ICEBREAKER]
Formato obrigatório: "Vi que [Nome da Empresa] oferece [serviço real da lista] — ..."
  ❌ PROIBIDO: "Vi sua empresa nas redes sociais e fiquei curioso..."
  ✅ CORRETO:  "Vi que a Clínica Sorri Bem oferece implantes dentários e ortodontia — queria entender como vocês estão captando novos pacientes."
O icebreaker deve SEMPRE usar o nome da empresa e ao menos 1 serviço listado.

[REGRA 3 — MARKETING_LEVEL BAIXO]
Se "Nível de Marketing Digital" for "baixo" ou "baixo":
  → Mencione EXPLICITAMENTE "baixa presença digital" no gap_critico
  → Conecte isso à perda de clientes que não encontram o negócio online
  → Exemplo: "Baixa presença digital impede que novos pacientes encontrem a clínica no Google"

[REGRA 4 — SEM AVALIAÇÕES NO GOOGLE]
Se não houver nota no Google Maps:
  → NÃO apenas informe a ausência. CONECTE ao impacto: "Clientes pesquisam no Google antes de decidir — sem avaliações, sua [tipo de negócio] é invisível para quem mais importa."
  → Quantifique a perda quando possível: "Você pode estar perdendo X% dos clientes que buscam [serviço] na sua região."

[REGRA 5 — SERVIÇOS]
Se a lista "Serviços/Produtos oferecidos" estiver preenchida:
  → Use ao menos 1 serviço da lista em cada seção principal (gap, icebreaker, pitch)
  → Construa o pitch em torno do impacto daquele serviço específico para o público-alvo informado

[REGRA 6 — PITCH COMERCIAL]
Conecte sempre: problema real → impacto financeiro → solução concreta
  Estrutura: "[Tipo de negócio] com [problema identificado] perde [impacto] — um site profissional com [solução] resolve isso."
  → Seja direto. Sem introduções. Sem rodeios.

[REGRA 7 — LINGUAGEM]
  • Direta e comercial
  • Zero termos vagos (ex: "potencializar", "alavancar", "otimizar")
  • Use verbos de ação: "captar", "converter", "fechar", "perder", "ganhar"`

// dossierOutputSchema define o formato JSON esperado da resposta LLM.
const dossierOutputSchema = `{
  "score_maturidade": <number 0-10>,
  "classificacao": "Iniciante|Intermediário|Avançado|Expert",
  "gap_critico": "<1 frase com business_type ou serviço real, max 120 chars>",
  "perda_estimada_mensal": "<ex: R$ 5.000 - R$ 15.000>",
  "icebreaker_whatsapp": "<obrigatório: 'Vi que [Empresa] oferece [serviço]...', max 280 chars>",
  "pitch_comercial": "<3-4 linhas: problema + impacto financeiro + solução para este tipo de negócio>",
  "objecao_prevista": "<objeção mais provável para este perfil específico>",
  "resposta_objecao": "<como contornar, usando o contexto do negócio>",
  "probabilidade_fechamento": "Baixa|Média|Alta",
  "proximos_passos": ["<passo 1>", "<passo 2>", "<passo 3>"],
  "resumo_executivo": "<3-5 linhas: panorama real do lead usando dados fornecidos>"
}`

func (s *DossierService) generateAnalysis(ctx context.Context, leadID string, lead *domain.Lead, agg *dossierAggregated) error {
	// Verificar cache antes de chamar o LLM
	var cached domain.LeadDossier
	if err := database.DB.WithContext(ctx).Where("lead_id = ?", leadID).First(&cached).Error; err == nil {
		log.Printf("[DossierService] cache hit para lead=%s — pulando chamada LLM", leadID)
		return nil
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return fmt.Errorf("GEMINI_API_KEY não configurada")
	}

	prompt := buildDossierPrompt(lead, agg)

	log.Printf("[DossierService] gerando dossiê via LLM para lead=%s", leadID)
	analysis, err := s.callGemini(ctx, apiKey, prompt)
	if err != nil {
		return err
	}

	if err := s.saveDossierAnalysis(ctx, leadID, analysis); err != nil {
		return fmt.Errorf("salvar dossier_analysis: %w", err)
	}

	// Persistir no cache para evitar nova chamada LLM
	leadUUID, _ := uuid.Parse(leadID)
	if err := database.DB.WithContext(ctx).Create(&domain.LeadDossier{
		LeadID:  leadUUID,
		Content: analysis,
	}).Error; err != nil {
		log.Printf("[DossierService] ⚠️ falha ao salvar cache de dossiê lead=%s: %v", leadID, err)
	}

	log.Printf("[DossierService] ✅ dossiê gerado e cacheado para lead=%s", leadID)
	return nil
}

// buildDossierPrompt monta o prompt completo para a LLM injetando todos os dados
// estruturados já enriquecidos, eliminando inferências genéricas.
func buildDossierPrompt(lead *domain.Lead, agg *dossierAggregated) string {
	log.Println("DEBUG PROMPT INSIGHTS:", agg.Insights)

	var sb strings.Builder

	sb.WriteString(dossierSystemPrompt)

	// ── Seção 1: Identidade do lead ───────────────────────────────────────────
	sb.WriteString("\n\n## IDENTIDADE DO LEAD\n")
	writeField(&sb, "Empresa", lead.Empresa)
	writeField(&sb, "Nicho", lead.Nicho)
	writeField(&sb, "Endereço", lead.Endereco)
	writeField(&sb, "Telefone", lead.Telefone)
	writeField(&sb, "Site", lead.Site)
	writeField(&sb, "E-mail", lead.Email)
	fmt.Fprintf(&sb, "Score de Oportunidade: %d/100\n", lead.Score)

	// ── Seção 2: Inteligência de negócio (BusinessInsights) ───────────────────
	sb.WriteString("\n## INTELIGÊNCIA DE NEGÓCIO (dados estruturados extraídos do site)\n")
	if agg.Insights != nil {
		writeField(&sb, "Tipo de Negócio", agg.Insights.BusinessType)
		writeField(&sb, "Público-Alvo", agg.Insights.TargetAudience)
		writeField(&sb, "Tom de Comunicação", agg.Insights.Tone)
		writeField(&sb, "Nível de Marketing Digital", agg.Insights.MarketingLevel)
		if agg.Insights.HasWhatsApp {
			sb.WriteString("✅ Usa WhatsApp: sim (mencionado ou linkado no site)\n")
		} else {
			sb.WriteString("⚠️ Usa WhatsApp: não identificado no site\n")
		}
		if len(agg.Insights.Services) > 0 {
			sb.WriteString("Serviços/Produtos oferecidos:\n")
			for _, svc := range agg.Insights.Services {
				fmt.Fprintf(&sb, "  - %s\n", svc)
			}
		}
	} else {
		sb.WriteString("(Insights de negócio não disponíveis — use os dados brutos abaixo)\n")
	}

	// ── Seção 3: Contexto textual do site/redes ───────────────────────────────
	if agg.RawText != "" {
		rawSummary := agg.RawText
		if len(rawSummary) > 800 {
			rawSummary = rawSummary[:800]
		}
		sb.WriteString("\n## CONTEXTO TEXTUAL (trecho do site/redes)\n")
		sb.WriteString(rawSummary)
		sb.WriteString("\n")
	}

	// ── Seção 4: Presença digital técnica ─────────────────────────────────────
	sb.WriteString("\n## PRESENÇA DIGITAL\n")

	nota := lead.Rating
	avaliacoes := lead.QtdAvaliacoes
	if agg.Google != nil {
		if agg.Google.NotaGeral != "" && agg.Google.NotaGeral != "0.0" {
			nota = agg.Google.NotaGeral
		}
		if agg.Google.TotalAvaliacoes != "" && agg.Google.TotalAvaliacoes != "0" {
			avaliacoes = agg.Google.TotalAvaliacoes
		}
	}
	notaValida := nota != "" && nota != "-" && nota != "0.0" && nota != "0"
	avaliacoesValidas := avaliacoes != "" && avaliacoes != "0"
	if notaValida || avaliacoesValidas {
		if notaValida {
			fmt.Fprintf(&sb, "✅ Nota Google Maps: %s (%s avaliações)\n", nota, avaliacoes)
		} else {
			fmt.Fprintf(&sb, "✅ Google Maps: %s avaliações (sem nota registrada)\n", avaliacoes)
		}
		if agg.Google != nil && len(agg.Google.ComentariosRecentes) > 0 {
			sb.WriteString("Comentários recentes:\n")
			for _, c := range agg.Google.ComentariosRecentes {
				fmt.Fprintf(&sb, "  - %s\n", c)
			}
		}
	} else {
		sb.WriteString("⚠️ Google Maps: sem avaliações ou não encontrado\n")
	}

	if agg.Website != nil {
		pixelStatus := "NÃO"
		if agg.Website.TemPixel {
			pixelStatus = "SIM"
		}
		gtmStatus := "NÃO"
		if agg.Website.TemGTM {
			gtmStatus = "SIM"
		}
		fmt.Fprintf(&sb, "Facebook Pixel instalado: %s\n", pixelStatus)
		fmt.Fprintf(&sb, "Google Tag Manager instalado: %s\n", gtmStatus)
	}

	if lead.Instagram != "" {
		fmt.Fprintf(&sb, "✅ Instagram: %s\n", lead.Instagram)
		if agg.Instagram != nil && agg.Instagram.Success && agg.Instagram.Bio != "" {
			fmt.Fprintf(&sb, "   Bio: %s\n", agg.Instagram.Bio)
		}
	}
	if lead.Facebook != "" {
		fmt.Fprintf(&sb, "✅ Facebook: %s\n", lead.Facebook)
	}
	if lead.LinkedIn != "" {
		fmt.Fprintf(&sb, "✅ LinkedIn: %s\n", lead.LinkedIn)
	}

	// ── Instrução final ───────────────────────────────────────────────────────
	sb.WriteString("\n## INSTRUÇÃO FINAL\n")
	sb.WriteString("Gere o dossiê usando OBRIGATORIAMENTE os dados de 'INTELIGÊNCIA DE NEGÓCIO' acima.\n")
	sb.WriteString("Cada seção (gap_critico, icebreaker, pitch_comercial) deve referenciar ao menos um dado concreto:\n")
	sb.WriteString("business_type, services, target_audience, marketing_level ou nota_google.\n")
	sb.WriteString("Retorne APENAS JSON válido com a estrutura abaixo, sem markdown:\n")
	sb.WriteString(dossierOutputSchema)

	return sb.String()
}

// writeField escreve um campo no prompt omitindo entradas vazias
// para não poluir o contexto da LLM com dados ausentes.
func writeField(sb *strings.Builder, label, value string) {
	if value != "" {
		fmt.Fprintf(sb, "✅ %s: %s\n", label, value)
	}
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
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
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

	// Extrair apenas o bloco JSON da resposta, descartando markdown envoltório
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
