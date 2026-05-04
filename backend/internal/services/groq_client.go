package services

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

	"github.com/digitalcombo/sherlock-scraper/backend/internal/config"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
)

const groqModel = "llama-3.3-70b-versatile"
const groqURL = "https://api.groq.com/openai/v1/chat/completions"

var groqHTTPClient = &http.Client{Timeout: 60 * time.Second}

type groqRequest struct {
	Model          string        `json:"model"`
	Messages       []groqMessage `json:"messages"`
	ResponseFormat groqRespFmt   `json:"response_format"`
	Temperature    float64       `json:"temperature"`
}

type groqMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type groqRespFmt struct {
	Type string `json:"type"`
}

type groqResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func callGroq(ctx context.Context, prompt string, temperature float64) (string, error) {
	apiKey := config.Get().GroqAPIKey
	if apiKey == "" {
		return "", fmt.Errorf("GROQ_API_KEY não configurada")
	}

	body, _ := json.Marshal(groqRequest{
		Model:          groqModel,
		Messages:       []groqMessage{{Role: "user", Content: prompt}},
		ResponseFormat: groqRespFmt{Type: "json_object"},
		Temperature:    temperature,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, groqURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("groq build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := groqHTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("groq http call: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("groq read body: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("groq status %d: %s", resp.StatusCode, string(raw))
	}

	var gr groqResponse
	if err := json.Unmarshal(raw, &gr); err != nil {
		return "", fmt.Errorf("groq unmarshal: %w", err)
	}
	if len(gr.Choices) == 0 {
		return "", fmt.Errorf("groq retornou resposta vazia")
	}
	return gr.Choices[0].Message.Content, nil
}

func groqGenerateLeadStrategy(input LeadAnalysisInput, settings domain.CompanySetting, skill string) (*LeadAnalysisOutput, error) {
	systemPrompt := buildSystemPrompt(settings, skill)

	var dataSummary string
	if skill == "raiox" {
		dataSummary = buildPromptInput(input)
		systemPrompt = fmt.Sprintf(systemPrompt, dataSummary)
		dataSummary = ""
	} else {
		dataSummary = buildDataAvailabilitySummary(input)
	}

	basePrompt := fmt.Sprintf("%s\n\n%s", systemPrompt, dataSummary)
	currentPrompt := basePrompt
	hasComments := len(input.ComentariosRecentes) > 0

	// Groq: temperatura maior para raiox evitar respostas homogêneas
	baseTemp := 0.3
	if skill == "raiox" {
		baseTemp = 0.7
	}

	var out LeadAnalysisOutput
	for attempt := 1; attempt <= maxRaioxRetries; attempt++ {
		// Aumenta temperatura a cada retry para forçar diversidade
		temp := baseTemp + float64(attempt-1)*0.1

		log.Printf("🟠 [tentativa %d/%d] Enviando prompt Groq (skill: %s, empresa: %s, temp=%.1f, %d chars)",
			attempt, maxRaioxRetries, skill, input.Empresa, temp, len(currentPrompt))

		text, err := callGroq(context.Background(), currentPrompt, temp)
		if err != nil {
			return nil, fmt.Errorf("groq lead strategy: %w", err)
		}

		log.Printf("📥 [tentativa %d] Resposta Groq (%d chars): %.300s...", attempt, len(text), text)
		text = cleanJSONResponse(text)

		if err := json.Unmarshal([]byte(text), &out); err != nil {
			log.Printf("❌ Groq parse error: %v | raw: %.200s", err, text)
			return nil, fmt.Errorf("groq parse: %w", err)
		}

		if skill == "raiox" {
			log.Printf("TENTATIVA %d - GAP: %s", attempt, out.GapCritico)
		}

		if skill == "raiox" && gapNeedsRegen(out.GapCritico, hasComments) {
			log.Printf("⚠️  [tentativa %d] Gap rejeitado (hasComments=%v): %q", attempt, hasComments, out.GapCritico)
			if attempt < maxRaioxRetries {
				currentPrompt = basePrompt + buildRetryPrompt(out.GapCritico, attempt)
				continue
			}
			log.Printf("⚠️  Máximo de tentativas atingido (%d). Mantendo último resultado.", maxRaioxRetries)
		} else if skill == "raiox" {
			log.Printf("✅ [tentativa %d] Gap aprovado: %q", attempt, out.GapCritico)
		}
		break
	}

	out.SkillUsed = skill
	log.Printf("GAP FINAL RETORNADO: %s", out.GapCritico)
	log.Printf("✅ Groq análise concluída (skill: %s): Score %d/10", skill, out.ScoreMaturidade)
	return &out, nil
}


func groqGeneratePipelineStages(niche string) (*AIPipelineResponse, error) {
	systemPrompt := `Você é um Especialista Sênior em Operações de Vendas e CRM.
Crie etapas de pipeline (Kanban) adequadas ao nicho informado.

Retorne APENAS JSON válido com esta estrutura exata:
{
  "pipeline_name": "Funil de Vendas para [Nicho]",
  "stages": [
    {"name": "[Etapa]", "order": 1, "color": "#HEX"}
  ]
}

Gere entre 4 a 6 etapas lógicas para uma jornada B2B daquele nicho. Cores em hex progressivas.`

	prompt := systemPrompt + "\n\nNICHO SOLICITADO:\n" + niche

	log.Printf("🟠 Enviando prompt de pipeline para Groq API...")

	text, err := callGroq(context.Background(), prompt, 0.3)
	if err != nil {
		return nil, fmt.Errorf("groq pipeline: %w", err)
	}

	text = strings.TrimSpace(cleanJSONResponse(text))

	var out AIPipelineResponse
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		log.Printf("❌ Groq pipeline parse error: %v | raw: %.200s", err, text)
		return nil, fmt.Errorf("groq pipeline parse: %w", err)
	}
	log.Printf("✅ Groq pipeline gerado: %d etapas", len(out.Stages))
	return &out, nil
}
