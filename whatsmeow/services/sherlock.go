package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/verbeux-ai/whatsmiau/env"
	"github.com/verbeux-ai/whatsmiau/server/dto"
	"go.uber.org/zap"
)

type SherlockService struct {
	httpClient       *http.Client
	baseURL          string
	internalAPIToken string
}

func NewSherlockService() *SherlockService {
	return &SherlockService{
		// Sem timeout global — cada chamada de polling tem o seu próprio prazo
		httpClient:       &http.Client{Timeout: 15 * time.Second},
		baseURL:          env.Env.SherlockURL,
		internalAPIToken: env.Env.InternalAPIToken,
	}
}

// scrapeStartResponse é a resposta de POST /internal/scrape-start
type scrapeStartResponse struct {
	JobID string `json:"job_id"`
}

// scrapeStatusResponse é a resposta de GET /internal/scrape-status/:job_id
type scrapeStatusResponse struct {
	JobID  string             `json:"job_id"`
	Status string             `json:"status"`
	Total  int                `json:"total"`
	Leads  []dto.SherlockLead `json:"leads"`
	Error  string             `json:"error"`
}

func (s *SherlockService) ExtractLeads(req dto.ExtractLeadsRequest) (*dto.ExtractLeadsResponse, error) {
	if req.Limit <= 0 {
		req.Limit = 20
	}

	// 1. Disparar job assíncrono
	startURL := fmt.Sprintf("%s/api/v1/internal/scrape-start", s.baseURL)
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest(http.MethodPost, startURL, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to build http request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Internal-Token", s.internalAPIToken)

	zap.L().Info("starting async lead extraction",
		zap.String("url", startURL),
		zap.String("keyword", req.Keyword),
		zap.String("location", req.Location),
		zap.Int("limit", req.Limit),
	)

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		zap.L().Error("failed to reach sherlock api", zap.Error(err))
		return nil, fmt.Errorf("sherlock api unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		zap.L().Warn("sherlock start returned unexpected status", zap.Int("status", resp.StatusCode))
		return nil, fmt.Errorf("sherlock start error: status %d", resp.StatusCode)
	}

	var startResp scrapeStartResponse
	if err := json.NewDecoder(resp.Body).Decode(&startResp); err != nil {
		return nil, fmt.Errorf("failed to decode start response: %w", err)
	}
	jobID := startResp.JobID
	zap.L().Info("scraping job created, starting polling", zap.String("job_id", jobID))

	// 2. Polling a cada 5s por até 5 minutos
	statusURL := fmt.Sprintf("%s/api/v1/internal/scrape-status/%s", s.baseURL, jobID)
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	deadline := time.After(5 * time.Minute)

	for {
		select {
		case <-deadline:
			zap.L().Error("sherlock polling timed out", zap.String("job_id", jobID))
			return nil, fmt.Errorf("sherlock scraping timed out after 5 minutes (job_id: %s)", jobID)

		case <-ticker.C:
			pollReq, err := http.NewRequest(http.MethodGet, statusURL, nil)
			if err != nil {
				continue
			}
			pollReq.Header.Set("X-Internal-Token", s.internalAPIToken)

			pollResp, err := s.httpClient.Do(pollReq)
			if err != nil {
				zap.L().Warn("polling request failed, retrying", zap.String("job_id", jobID), zap.Error(err))
				continue
			}

			var statusResp scrapeStatusResponse
			json.NewDecoder(pollResp.Body).Decode(&statusResp)
			pollResp.Body.Close()

			zap.L().Info("polling scraping job", zap.String("job_id", jobID), zap.String("status", statusResp.Status))

			switch statusResp.Status {
			case "completed":
				zap.L().Info("lead extraction completed", zap.Int("leads_found", statusResp.Total))
				return &dto.ExtractLeadsResponse{
					Total: statusResp.Total,
					Leads: statusResp.Leads,
				}, nil

			case "error":
				zap.L().Error("sherlock scraping returned error", zap.String("job_id", jobID), zap.String("error", statusResp.Error))
				return nil, fmt.Errorf("sherlock scraping failed: %s", statusResp.Error)
			}
			// status "running": aguarda próximo tick
		}
	}
}
