package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/verbeux-ai/whatsmiau/env"
	"go.uber.org/zap"
)

// GeminiService gera análises comerciais de leads via Google Gemini (REST API).
type GeminiService struct {
	apiKey     string
	httpClient *http.Client
}

func NewGeminiService() *GeminiService {
	return &GeminiService{
		apiKey:     env.Get().GeminiAPIKey,
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// LeadAnalysisInput reúne todos os dados disponíveis de um lead para o prompt.
type LeadAnalysisInput struct {
	// Dados do lead (prospectado)
	Empresa       string
	Nicho         string
	ResumoNegocio string
	Endereco      string
	Telefone      string
	TipoTelefone  string
	LinkWhatsapp  string
	Email         string
	Site          string
	Rating        string
	Reviews       string
	Instagram     string
	Facebook      string
	LinkedIn      string
	TikTok        string
	YouTube       string

	// Contexto do vendedor (empresa que usa o WhatsMiau)
	VendedorNome   string
	VendedorNicho  string
	VendedorOferta string
	VendedorTom    string
}

// LeadAnalysisOutput é o dossiê gerado pela IA.
type LeadAnalysisOutput struct {
	SkillUsed               string   `json:"skill_used"`
	ScoreMaturidade         int      `json:"score_maturidade"`
	Classificacao           string   `json:"classificacao"`
	GapCritico              string   `json:"gap_critico,omitempty"`
	PerdaEstimadaMensal     string   `json:"perda_estimada_mensal,omitempty"`
	IcebreakerWhatsapp      string   `json:"icebreaker_whatsapp,omitempty"`
	PitchComercial          string   `json:"pitch_comercial,omitempty"`
	ObjecaoPrevista         string   `json:"objecao_prevista,omitempty"`
	RespostaObjecao         string   `json:"resposta_objecao,omitempty"`
	ProbabilidadeFechamento string   `json:"probabilidade_fechamento"`
	ProximosPassos          []string `json:"proximos_passos"`
	EmailSubject            string   `json:"email_subject,omitempty"`
	EmailBody               string   `json:"email_body,omitempty"`
	CallScript              string   `json:"call_script,omitempty"`
	GatekeeperBypass        string   `json:"gatekeeper_bypass,omitempty"`
}

// GenerateLeadStrategy gera um dossiê de inteligência comercial para o lead.
// skill: "raiox" (padrão) | "email" | "call"
func (g *GeminiService) GenerateLeadStrategy(input LeadAnalysisInput, skill string) (*LeadAnalysisOutput, error) {
	if skill == "" {
		skill = "raiox"
	}

	prompt := buildGeminiPrompt(input, skill)

	if g.apiKey == "" {
		zap.L().Warn("[GeminiService] GEMINI_API_KEY ausente — tentando Groq")
		if result, err := CallGroqForLeadAnalysis(context.Background(), prompt, skill); err == nil {
			return result, nil
		} else {
			zap.L().Warn("[GeminiService] Groq também falhou — retornando mock", zap.Error(err))
			return g.mockOutput(input, skill), nil
		}
	}

	result, err := g.callGemini(prompt)
	if err != nil {
		zap.L().Warn("[GeminiService] Gemini falhou — tentando Groq", zap.Error(err))
		if groqResult, groqErr := CallGroqForLeadAnalysis(context.Background(), prompt, skill); groqErr == nil {
			return groqResult, nil
		}
		return nil, fmt.Errorf("gemini api error: %w", err)
	}

	result.SkillUsed = skill
	return result, nil
}

// ---------- internals ----------

// geminiRequest é o payload enviado para a API REST do Gemini.
type geminiRequest struct {
	Contents []geminiContent `json:"contents"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

// geminiResponse é a resposta da API REST do Gemini.
type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func (g *GeminiService) callGemini(prompt string) (*LeadAnalysisOutput, error) {
	apiURL := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=%s",
		g.apiKey,
	)

	reqBody := geminiRequest{
		Contents: []geminiContent{
			{Parts: []geminiPart{{Text: prompt}}},
		},
	}
	bodyBytes, _ := json.Marshal(reqBody)

	ctx, cancel := context.WithTimeout(context.Background(), 55*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gemini returned status %d: %s", resp.StatusCode, string(body))
	}

	var gemResp geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&gemResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if len(gemResp.Candidates) == 0 || len(gemResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from gemini")
	}

	raw := gemResp.Candidates[0].Content.Parts[0].Text
	raw = cleanJSON(raw)

	var output LeadAnalysisOutput
	if err := json.Unmarshal([]byte(raw), &output); err != nil {
		return nil, fmt.Errorf("parse json output: %w (raw: %.200s)", err, raw)
	}
	return &output, nil
}

func buildGeminiPrompt(input LeadAnalysisInput, skill string) string {
	dataSummary := buildDataSummary(input)

	var systemPrompt, outputFormat string

	switch skill {
	case "email":
		systemPrompt = `Você é um Copywriter B2B Sênior especializado em Cold Emails.
Sua missão: analisar dados de um lead e gerar um E-mail Frio de prospecção altamente conversivo.

REGRAS DE HONESTIDADE (OBRIGATÓRIAS):
- Dados marcados com ✅ estão disponíveis. Dados marcados com ❌ NÃO estão disponíveis.
- Você SÓ pode referenciar dados ✅. NUNCA invente dados ❌.
- O assunto e corpo DEVEM citar pelo menos 1 dado REAL e ESPECÍFICO do lead.`

		outputFormat = `{
  "score_maturidade": number (0-10),
  "classificacao": "Iniciante|Intermediário|Avançado|Expert",
  "probabilidade_fechamento": "Baixa|Média|Alta",
  "proximos_passos": ["string", "string"],
  "email_subject": "string (assunto curto e que gere curiosidade)",
  "email_body": "string (corpo do e-mail, max 3 parágrafos)"
}`

	case "call":
		systemPrompt = `Você é um SDR Sênior especializado em Cold Call B2B.
Sua missão: analisar dados de um lead e gerar um roteiro de ligação fria eficiente.

REGRAS DE HONESTIDADE (OBRIGATÓRIAS):
- Dados marcados com ✅ estão disponíveis. Dados marcados com ❌ NÃO estão disponíveis.
- O script DEVE citar pelo menos 1 dado REAL do lead na abertura.
- Forneça também um "gatekeeper bypass" respeitoso para passar pela secretária.`

		outputFormat = `{
  "score_maturidade": number (0-10),
  "classificacao": "Iniciante|Intermediário|Avançado|Expert",
  "probabilidade_fechamento": "Baixa|Média|Alta",
  "proximos_passos": ["string", "string"],
  "call_script": "string (roteiro completo: abertura, pitch e CTA)",
  "gatekeeper_bypass": "string (tática curta para passar pela recepcionista)"
}`

	default: // raiox
		systemPrompt = `Você é um Especialista Sênior em Growth B2B.
Sua missão: analisar dados de um lead e gerar uma estratégia de abordagem comercial personalizada.

REGRAS DE HONESTIDADE (OBRIGATÓRIAS):
- Dados marcados com ✅ estão disponíveis. Dados marcados com ❌ NÃO estão disponíveis.
- Você SÓ pode fazer afirmações sobre dados ✅. NUNCA invente dados ❌.
- O "gap_critico" SÓ pode referenciar dados existentes.
- O "icebreaker_whatsapp" DEVE citar um dado REAL e ESPECÍFICO (nota exata, reviews, nome).
- Se quase tudo está ❌, o gap é sobre AUSÊNCIA de presença digital.

SCORES:
- 0-3 (Iniciante): sem site, sem redes, <20 reviews
- 4-6 (Intermediário): redes ativas mas sem tracking
- 7-8 (Avançado): tem GTM/Pixel mas gaps evidentes
- 9-10 (Expert): tracking completo e automação`

		outputFormat = `{
  "score_maturidade": number (0-10),
  "classificacao": "Iniciante|Intermediário|Avançado|Expert",
  "gap_critico": "string (1 frase específica, max 120 chars)",
  "perda_estimada_mensal": "string (ex: 'R$ 5.000 - R$ 15.000')",
  "icebreaker_whatsapp": "string (2 linhas, max 280 chars, cite dado REAL)",
  "pitch_comercial": "string (3-4 linhas, foque em ROI e problema específico do lead)",
  "objecao_prevista": "string (objeção mais provável baseada no perfil)",
  "resposta_objecao": "string (como contornar a objeção)",
  "probabilidade_fechamento": "Baixa|Média|Alta",
  "proximos_passos": ["string", "string", "string"]
}`
	}

	vendedorCtx := buildVendedorContext(input)

	return fmt.Sprintf(`%s

%s

%s

## OUTPUT ESPERADO (JSON puro, sem markdown):

Retorne APENAS um JSON válido com esta estrutura exata:
%s

IMPORTANTE: Seja ULTRA-ESPECÍFICO. Use números exatos. Genérico = Descartado.`,
		systemPrompt, vendedorCtx, dataSummary, outputFormat)
}

func buildVendedorContext(input LeadAnalysisInput) string {
	if input.VendedorNome == "" && input.VendedorNicho == "" && input.VendedorOferta == "" {
		return ""
	}
	var sb strings.Builder
	sb.WriteString("## CONTEXTO DO VENDEDOR (quem está prospectando este lead):\n\n")
	if input.VendedorNome != "" {
		sb.WriteString(fmt.Sprintf("- Empresa: %s\n", input.VendedorNome))
	}
	if input.VendedorNicho != "" {
		sb.WriteString(fmt.Sprintf("- Nicho: %s\n", input.VendedorNicho))
	}
	if input.VendedorOferta != "" {
		sb.WriteString(fmt.Sprintf("- Oferta/Solução: %s\n", input.VendedorOferta))
	}
	if input.VendedorTom != "" {
		sb.WriteString(fmt.Sprintf("- Tom de voz preferido: %s\n", input.VendedorTom))
	}
	sb.WriteString("\nUSE este contexto para personalizar o pitch, icebreaker e gap crítico para a oferta do vendedor.\n")
	return sb.String()
}

func buildDataSummary(input LeadAnalysisInput) string {
	var sb strings.Builder
	sb.WriteString("## DADOS DO LEAD:\n\n")

	avail := func(label, val string) {
		if val != "" {
			sb.WriteString(fmt.Sprintf("✅ %s: %s\n", label, val))
		} else {
			sb.WriteString(fmt.Sprintf("❌ %s: NÃO DISPONÍVEL\n", label))
		}
	}

	avail("Nome da Empresa", input.Empresa)
	avail("Nicho/Categoria", input.Nicho)
	avail("Resumo do Negócio", input.ResumoNegocio)
	avail("Endereço", input.Endereco)

	sb.WriteString("\n### Contato:\n")
	if input.Telefone != "" {
		tipo := input.TipoTelefone
		if tipo == "" {
			tipo = "não identificado"
		}
		sb.WriteString(fmt.Sprintf("✅ Telefone: %s (tipo: %s)\n", input.Telefone, tipo))
	} else {
		sb.WriteString("❌ Telefone: NÃO ENCONTRADO\n")
	}
	avail("WhatsApp", input.LinkWhatsapp)
	avail("E-mail", input.Email)

	sb.WriteString("\n### Presença Digital:\n")
	avail("Site", input.Site)

	sb.WriteString("\n### Google:\n")
	avail("Nota Google", input.Rating)
	avail("Total de Avaliações", input.Reviews)

	sb.WriteString("\n### Redes Sociais:\n")
	avail("Instagram", input.Instagram)
	avail("Facebook", input.Facebook)
	avail("LinkedIn", input.LinkedIn)
	avail("TikTok", input.TikTok)
	avail("YouTube", input.YouTube)

	return sb.String()
}

func cleanJSON(text string) string {
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start != -1 && end != -1 && end > start {
		return text[start : end+1]
	}
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	return strings.TrimSpace(text)
}

func (g *GeminiService) mockOutput(input LeadAnalysisInput, skill string) *LeadAnalysisOutput {
	empresa := input.Empresa
	if empresa == "" {
		empresa = "a empresa"
	}
	return &LeadAnalysisOutput{
		SkillUsed:               skill,
		ScoreMaturidade:         6,
		Classificacao:           "Intermediário",
		GapCritico:              fmt.Sprintf("%s possui presença digital mas não utiliza ferramentas de rastreamento para otimizar conversões.", empresa),
		PerdaEstimadaMensal:     "R$ 5.000 - R$ 12.000",
		IcebreakerWhatsapp:      fmt.Sprintf("Olá! Vi que %s aparece no Google com boas avaliações. Vocês já pensaram em converter mais desses visitantes em clientes?", empresa),
		PitchComercial:          "Nossa solução transforma visitantes anônimos do seu site em leads qualificados, aumentando suas conversões sem precisar investir mais em tráfego.",
		ObjecaoPrevista:         "Não temos orçamento para isso agora.",
		RespostaObjecao:         "Entendo! Nossa solução foca em maximizar o ROI do investimento atual — você não investe mais, só converte melhor.",
		ProbabilidadeFechamento: "Média",
		ProximosPassos:          []string{"Enviar prova social do mesmo nicho", "Agendar reunião técnica de 20 min", "Apresentar plano de 30 dias"},
	}
}
