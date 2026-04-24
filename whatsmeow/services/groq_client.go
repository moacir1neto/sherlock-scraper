package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/verbeux-ai/whatsmiau/env"
)

const groqModel = "llama-3.3-70b-versatile"
const groqURL = "https://api.groq.com/openai/v1/chat/completions"

type groqRequest struct {
	Model          string         `json:"model"`
	Messages       []groqMessage  `json:"messages"`
	ResponseFormat groqRespFormat `json:"response_format"`
	Temperature    float64        `json:"temperature"`
}

type groqMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type groqRespFormat struct {
	Type string `json:"type"`
}

type groqResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

var groqHTTPClient = &http.Client{Timeout: 45 * time.Second}

func callGroq(ctx context.Context, prompt string) (string, error) {
	apiKey := env.Env.GroqAPIKey
	if apiKey == "" {
		return "", fmt.Errorf("GROQ_API_KEY não configurada")
	}

	body, _ := json.Marshal(groqRequest{
		Model:          groqModel,
		Messages:       []groqMessage{{Role: "user", Content: prompt}},
		ResponseFormat: groqRespFormat{Type: "json_object"},
		Temperature:    0.3,
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

// CallGroqForLeadAnalysis chama Groq e faz parse para LeadAnalysisOutput.
func CallGroqForLeadAnalysis(ctx context.Context, prompt, skill string) (*LeadAnalysisOutput, error) {
	text, err := callGroq(ctx, prompt)
	if err != nil {
		return nil, err
	}
	text = cleanJSON(text)
	var out LeadAnalysisOutput
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return nil, fmt.Errorf("groq lead parse: %w (raw: %.200s)", err, text)
	}
	out.SkillUsed = skill
	return &out, nil
}

// CallGroqForAgent chama Groq e faz parse para AgentResponse.
func CallGroqForAgent(ctx context.Context, prompt string) (*AgentResponse, error) {
	text, err := callGroq(ctx, prompt)
	if err != nil {
		return nil, err
	}
	text = cleanJSON(text)
	var out AgentResponse
	if err := json.Unmarshal([]byte(text), &out); err != nil {
		return nil, fmt.Errorf("groq agent parse: %w (raw: %.200s)", err, text)
	}
	return &out, nil
}
