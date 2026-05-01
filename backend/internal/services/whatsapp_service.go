package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/config"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
)

type whatsAppService struct {
	baseURL string
	apiKey  string
}

func NewWhatsAppService() ports.WhatsAppService {
	url := config.Get().WhatsmeowURL
	if url == "" {
		url = "http://localhost:8081"
	}
	return &whatsAppService{
		baseURL: url,
		apiKey:  config.Get().WhatsmeowAPIToken,
	}
}

func (s *whatsAppService) SendTextMessage(ctx context.Context, instanceID, number, text string) error {
	url := fmt.Sprintf("%s/v1/instance/%s/message/text", s.baseURL, instanceID)

	payload := map[string]string{
		"number": number,
		"text":   text,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	if s.apiKey != "" {
		req.Header.Set("apikey", s.apiKey)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("whatsmeow-api returned status: %d", resp.StatusCode)
	}

	return nil
}

func (s *whatsAppService) GetInstances(ctx context.Context) ([]map[string]interface{}, error) {
	url := fmt.Sprintf("%s/v1/instance", s.baseURL)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	if s.apiKey != "" {
		req.Header.Set("apikey", s.apiKey)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("whatsmeow-api returned status: %d", resp.StatusCode)
	}

	var instances []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&instances); err != nil {
		return nil, err
	}

	return instances, nil
}
