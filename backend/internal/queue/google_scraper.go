package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/config"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/logger"
	"go.uber.org/zap"
)

// GoogleData representa os dados de avaliação extraídos do Google Places API
type GoogleData struct {
	NotaGeral           string   `json:"nota_geral,omitempty"`
	TotalAvaliacoes     string   `json:"total_avaliacoes,omitempty"`
	ComentariosRecentes []string `json:"comentarios_recentes,omitempty"`
}

// ═══════════════════════════════════════════════════════════════
// Google Places API Response Structures
// ═══════════════════════════════════════════════════════════════

// TextSearchResponse representa a resposta do Text Search da Places API
type TextSearchResponse struct {
	Results []struct {
		PlaceID string `json:"place_id"`
		Name    string `json:"name"`
	} `json:"results"`
	Status       string `json:"status"`
	ErrorMessage string `json:"error_message,omitempty"`
}

// PlaceDetailsResponse representa a resposta do Place Details da Places API
type PlaceDetailsResponse struct {
	Result struct {
		Rating           float64  `json:"rating"`
		UserRatingsTotal int      `json:"user_ratings_total"`
		Reviews          []Review `json:"reviews"`
	} `json:"result"`
	Status       string `json:"status"`
	ErrorMessage string `json:"error_message,omitempty"`
}

// Review representa uma avaliação individual do Google
type Review struct {
	AuthorName string `json:"author_name"`
	Rating     int    `json:"rating"`
	Text       string `json:"text"`
	Time       int64  `json:"time"`
}

// ═══════════════════════════════════════════════════════════════
// Main Function
// ═══════════════════════════════════════════════════════════════

// ScrapeGoogleReviews extrai avaliações do Google usando a Places API oficial
// Retorna nil e erro se não encontrar o estabelecimento ou houver problemas de API
func ScrapeGoogleReviews(ctx context.Context, nomeEmpresa string) (*GoogleData, error) {
	l := logger.FromContext(ctx)
	if nomeEmpresa == "" {
		l.Warn("google_reviews_nome_vazio")
		return nil, fmt.Errorf("nome da empresa vazio")
	}

	l.Info("iniciando_google_reviews_api", zap.String("empresa", nomeEmpresa))

	// A. Validar API Key
	apiKey := config.Get().GooglePlacesAPIKey
	if apiKey == "" {
		l.Error("google_places_api_key_ausente")
		return nil, fmt.Errorf("GOOGLE_PLACES_API_KEY não configurada")
	}

	// B. Text Search para obter place_id
	placeID, err := searchPlace(ctx, nomeEmpresa, apiKey)
	if err != nil {
		l.Warn("erro_buscar_place_id", zap.Error(err))
		return nil, fmt.Errorf("erro ao buscar place_id: %w", err)
	}

	if placeID == "" {
		l.Warn("estabelecimento_google_nao_encontrado", zap.String("empresa", nomeEmpresa))
		return nil, fmt.Errorf("estabelecimento não encontrado")
	}

	l.Debug("place_id_encontrado", zap.String("place_id", placeID))

	// C. Place Details para obter rating, total de avaliações e reviews
	details, err := getPlaceDetails(ctx, placeID, apiKey)
	if err != nil {
		l.Warn("erro_buscar_detalhes_place", zap.Error(err))
		return nil, fmt.Errorf("erro ao buscar detalhes: %w", err)
	}

	// D. Mapear para GoogleData
	googleData := &GoogleData{
		ComentariosRecentes: []string{},
	}

	// Converter rating para string com vírgula (padrão BR)
	if details.Result.Rating > 0 {
		googleData.NotaGeral = fmt.Sprintf("%.1f", details.Result.Rating)
		googleData.NotaGeral = replaceDecimalDot(googleData.NotaGeral)
		l.Debug("nota_google_extraida", zap.String("nota", googleData.NotaGeral))
	}

	// Converter total de avaliações para string
	if details.Result.UserRatingsTotal > 0 {
		googleData.TotalAvaliacoes = strconv.Itoa(details.Result.UserRatingsTotal)
		l.Debug("total_avaliacoes_google", zap.String("total", googleData.TotalAvaliacoes))
	}

	// Extrair até 5 comentários recentes
	maxReviews := min(len(details.Result.Reviews), 5)
	for i := 0; i < maxReviews; i++ {
		review := details.Result.Reviews[i]
		if review.Text != "" {
			googleData.ComentariosRecentes = append(googleData.ComentariosRecentes, review.Text)
		}
	}

	if len(googleData.ComentariosRecentes) > 0 {
		l.Debug("comentarios_google_extraidos", zap.Int("count", len(googleData.ComentariosRecentes)))
	}

	l.Info("google_reviews_extraido_sucesso", zap.String("empresa", nomeEmpresa))
	return googleData, nil
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

// searchPlace faz uma busca textual para encontrar o place_id
func searchPlace(ctx context.Context, query string, apiKey string) (string, error) {
	baseURL := "https://maps.googleapis.com/maps/api/place/textsearch/json"

	// Build query parameters
	params := url.Values{}
	params.Add("query", query)
	params.Add("key", apiKey)
	params.Add("language", "pt-BR")

	searchURL := fmt.Sprintf("%s?%s", baseURL, params.Encode())

	logger.FromContext(ctx).Debug("executando_google_text_search")

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Make GET request
	resp, err := client.Get(searchURL)
	if err != nil {
		return "", fmt.Errorf("erro ao fazer requisição HTTP: %w", err)
	}
	defer resp.Body.Close()

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP status %d", resp.StatusCode)
	}

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("erro ao ler resposta: %w", err)
	}

	// Parse JSON response
	var searchResponse TextSearchResponse
	if err := json.Unmarshal(body, &searchResponse); err != nil {
		return "", fmt.Errorf("erro ao parsear JSON: %w", err)
	}

	// Check API status
	if searchResponse.Status != "OK" {
		if searchResponse.Status == "REQUEST_DENIED" {
			logger.FromContext(ctx).Error("google_api_denied", zap.String("message", searchResponse.ErrorMessage))
		} else {
			logger.FromContext(ctx).Warn("google_places_api_status", zap.String("status", searchResponse.Status))
		}

		if searchResponse.Status == "ZERO_RESULTS" {
			return "", nil // Não é erro fatal, apenas não encontrou
		}
		return "", fmt.Errorf("API status: %s", searchResponse.Status)
	}

	// Return first result's place_id
	if len(searchResponse.Results) > 0 {
		logger.FromContext(ctx).Debug("estabelecimento_encontrado_google",
			zap.String("name", searchResponse.Results[0].Name),
			zap.String("place_id", searchResponse.Results[0].PlaceID),
		)
		return searchResponse.Results[0].PlaceID, nil
	}

	return "", nil
}

// getPlaceDetails busca detalhes completos do lugar incluindo reviews
func getPlaceDetails(ctx context.Context, placeID string, apiKey string) (*PlaceDetailsResponse, error) {
	baseURL := "https://maps.googleapis.com/maps/api/place/details/json"

	// Build query parameters
	params := url.Values{}
	params.Add("place_id", placeID)
	params.Add("fields", "rating,user_ratings_total,reviews")
	params.Add("key", apiKey)
	params.Add("language", "pt-BR")

	detailsURL := fmt.Sprintf("%s?%s", baseURL, params.Encode())

	logger.FromContext(ctx).Debug("executando_google_place_details")

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Make GET request
	resp, err := client.Get(detailsURL)
	if err != nil {
		return nil, fmt.Errorf("erro ao fazer requisição HTTP: %w", err)
	}
	defer resp.Body.Close()

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP status %d", resp.StatusCode)
	}

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("erro ao ler resposta: %w", err)
	}

	// Parse JSON response
	var detailsResponse PlaceDetailsResponse
	if err := json.Unmarshal(body, &detailsResponse); err != nil {
		return nil, fmt.Errorf("erro ao parsear JSON: %w", err)
	}

	// Check API status
	if detailsResponse.Status != "OK" {
		if detailsResponse.Status == "REQUEST_DENIED" {
			logger.FromContext(ctx).Error("google_api_denied_details", zap.String("message", detailsResponse.ErrorMessage))
		}
		return nil, fmt.Errorf("API status: %s", detailsResponse.Status)
	}

	return &detailsResponse, nil
}

// replaceDecimalDot substitui ponto decimal por vírgula (padrão brasileiro)
func replaceDecimalDot(s string) string {
	result := ""
	for _, char := range s {
		if char == '.' {
			result += ","
		} else {
			result += string(char)
		}
	}
	return result
}

// min retorna o menor de dois inteiros
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
