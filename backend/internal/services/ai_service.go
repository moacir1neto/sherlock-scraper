package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

// AIService handles AI-powered lead analysis using Google Gemini
type AIService struct {
	apiKey string
}

// LeadAnalysisInput representa os dados de entrada para análise
type LeadAnalysisInput struct {
	Empresa             string   `json:"empresa"`
	NotaGoogle          string   `json:"nota_google"`
	TotalReviews        string   `json:"total_reviews"`
	ComentariosRecentes []string `json:"comentarios_recentes"`
	BioInstagram        string   `json:"bio_instagram"`
	TemPixel            bool     `json:"tem_pixel"`
	TemGTM              bool     `json:"tem_gtm"`
	Site                string   `json:"site"`
	Nicho               string   `json:"nicho"`
}

// LeadAnalysisOutput representa o resultado da análise de IA
type LeadAnalysisOutput struct {
	ScoreMaturidade         int      `json:"score_maturidade"`
	Classificacao           string   `json:"classificacao"`
	GapCritico              string   `json:"gap_critico"`
	PerdaEstimadaMensal     string   `json:"perda_estimada_mensal"`
	IcebreakerWhatsapp      string   `json:"icebreaker_whatsapp"`
	PitchComercial          string   `json:"pitch_comercial"`
	ObjecaoPrevista         string   `json:"objecao_prevista"`
	RespostaObjecao         string   `json:"resposta_objecao"`
	ProbabilidadeFechamento string   `json:"probabilidade_fechamento"`
	ProximosPassos          []string `json:"proximos_passos"`
}

// NewAIService cria uma nova instância do serviço de IA
func NewAIService() *AIService {
	return &AIService{
		apiKey: os.Getenv("GEMINI_API_KEY"),
	}
}

// GenerateLeadStrategy gera estratégia comercial usando IA para um lead
func (s *AIService) GenerateLeadStrategy(input LeadAnalysisInput, settings domain.CompanySetting) (*LeadAnalysisOutput, error) {
	if s.apiKey == "" {
		log.Printf("⚠️  GEMINI_API_KEY não configurada - pulando análise de IA")
		return nil, fmt.Errorf("GEMINI_API_KEY não configurada")
	}

	log.Printf("🤖 Iniciando análise de IA para: %s", input.Empresa)

	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(s.apiKey))
	if err != nil {
		log.Printf("❌ Erro ao criar cliente Gemini: %v", err)
		return nil, fmt.Errorf("erro ao criar cliente Gemini: %w", err)
	}
	defer client.Close()

	// Usa o modelo Gemini 1.5 Flash (rápido e econômico)
	model := client.GenerativeModel("gemini-3.1-flash-lite-preview")

	// Configura o modelo para retornar JSON
	model.ResponseMIMEType = "application/json"

	// System Prompt estruturado com contexto dinâmico da empresa
	systemPrompt := buildSystemPrompt(settings)

	// Converte input para JSON
	inputJSON, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("erro ao serializar input: %w", err)
	}

	// Monta o prompt completo
	fullPrompt := fmt.Sprintf("%s\n\nINPUT:\n%s", systemPrompt, string(inputJSON))

	log.Printf("📤 Enviando prompt para Gemini API...")

	// Gera conteúdo
	resp, err := model.GenerateContent(ctx, genai.Text(fullPrompt))
	if err != nil {
		log.Printf("❌ Erro ao gerar conteúdo: %v", err)
		return nil, fmt.Errorf("erro ao gerar conteúdo: %w", err)
	}

	// Extrai o texto da resposta
	var resultText string
	for _, cand := range resp.Candidates {
		if cand.Content != nil {
			for _, part := range cand.Content.Parts {
				resultText += fmt.Sprintf("%v", part)
			}
		}
	}

	if resultText == "" {
		return nil, fmt.Errorf("resposta vazia da API Gemini")
	}

	log.Printf("📥 Resposta recebida da Gemini API (%d chars)", len(resultText))

	// Remove possíveis markdown code blocks (```json ... ```)
	resultText = cleanJSONResponse(resultText)

	// Parse JSON response
	var output LeadAnalysisOutput
	if err := json.Unmarshal([]byte(resultText), &output); err != nil {
		log.Printf("❌ Erro ao parsear resposta JSON: %v", err)
		log.Printf("Resposta bruta: %s", resultText)
		return nil, fmt.Errorf("erro ao parsear resposta JSON: %w", err)
	}

	log.Printf("✅ Análise de IA concluída: Score %d/10, Gap: %s",
		output.ScoreMaturidade, output.GapCritico)

	return &output, nil
}

// buildSystemPrompt constrói o prompt do sistema para o Gemini com contexto dinâmico da empresa
func buildSystemPrompt(settings domain.CompanySetting) string {
	return fmt.Sprintf(`## CONTEXTO DA EMPRESA QUE ESTÁ PROSPECTANDO:

- **Nome da Empresa**: %s
- **Nicho de Atuação**: %s
- **Oferta Principal**: %s
- **Tom de Voz**: %s

Você é um Especialista Sênior em Growth B2B que trabalha para a empresa "%s" (nicho: %s).
Sua missão é analisar dados de empresas capturados por ferramentas de scraping e gerar estratégias de abordagem comercial personalizadas.

REGRA FUNDAMENTAL: Todos os "Gaps Críticos", "Icebreakers" e "Pitches" devem ser baseados EXCLUSIVAMENTE na oferta principal da empresa: "%s".
Adapte toda a linguagem ao tom de voz: %s.

IMPORTANTE: Seja ULTRA-ESPECÍFICO. Use números exatos, cite comentários reais, mencione tecnologias específicas detectadas. Genérico = Descartado.

## REGRAS DE ANÁLISE:

### 1. Score de Maturidade (0-10):
- 0-3 (Iniciante): Sem site, sem redes sociais, <20 reviews
- 4-6 (Intermediário): Redes ativas, mas sem tracking (Pixel/GTM)
- 7-8 (Avançado): GTM instalado, algumas métricas, mas gaps evidentes
- 9-10 (Expert): Pixel + GTM + Automação + ROI mensurado

### 2. Gap Crítico (Hierarquia):
Analise os gaps sob a perspectiva de como a oferta "%s" resolveria o problema do lead.
1. Sem Pixel + Com GTM = "Tráfego monitorado mas não monetizado"
2. Sem GTM + Sem Pixel = "Cego digitalmente - não sabe de onde vem cliente"
3. Muitos Reviews + Sem Presença Digital = "Reputação desperdiçada"
4. Bio Fraca + Muitos Seguidores = "Audiência sem conversão"

### 3. Cálculo de Perda Estimada:
Estime a perda financeira mensal do lead considerando o nicho dele e como a falta da solução oferecida por "%s" impacta seu faturamento.

### 4. Probabilidade de Fechamento:

**Alta (70-90%%)**:
- Score 6-8 + Gap Crítico evidente + Reviews >100 + Nicho premium

**Média (40-70%%)**:
- Score 4-6 + Presença digital mediana + Reviews 50-100

**Baixa (10-40%%)**:
- Score 0-3 + Pouca presença digital + Reviews <50

## OUTPUT ESPERADO (JSON):

Retorne APENAS um JSON válido com esta estrutura exata:

{
  "score_maturidade": number (0-10),
  "classificacao": "string (Iniciante|Intermediário|Avançado|Expert)",
  "gap_critico": "string (1 frase específica, max 120 chars, relacionada à oferta de %s)",
  "perda_estimada_mensal": "string (ex: 'R$ 30.000 - R$ 50.000')",
  "icebreaker_whatsapp": "string (2 linhas, max 280 chars, cite número EXATO de reviews, tom: %s)",
  "pitch_comercial": "string (3-4 linhas, foque em ROI + como %s resolve o problema específico do lead)",
  "objecao_prevista": "string (objeção mais provável baseada no perfil)",
  "resposta_objecao": "string (como contornar a objeção usando cases de %s)",
  "probabilidade_fechamento": "string (Baixa|Média|Alta)",
  "proximos_passos": ["string", "string", "string"]
}

IMPORTANTE:
- SEMPRE cite números exatos (ex: "296 reviews", não "muitos reviews")
- SEMPRE mencione tecnologias específicas (ex: "Google Tag Manager detectado")
- SEMPRE calcule perda financeira baseada no nicho do lead
- SEMPRE conecte os gaps com a oferta de %s: "%s"
- NUNCA seja genérico ou use templates vazios`,
		settings.CompanyName,
		settings.Niche,
		settings.MainOffer,
		settings.ToneOfVoice,
		settings.CompanyName,
		settings.Niche,
		settings.MainOffer,
		settings.ToneOfVoice,
		settings.MainOffer,
		settings.CompanyName,
		settings.CompanyName,
		settings.ToneOfVoice,
		settings.CompanyName,
		settings.CompanyName,
		settings.CompanyName,
		settings.MainOffer,
	)
}

// cleanJSONResponse remove markdown code blocks e espaços extras
func cleanJSONResponse(text string) string {
	// Remove ```json e ``` se existirem
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)
	return text
}
