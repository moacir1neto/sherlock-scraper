package queue

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"
)

// GoogleData representa os dados de avaliação extraídos do Google Places API
type GoogleData struct {
	NotaGeral          string   `json:"nota_geral,omitempty"`
	TotalAvaliacoes    string   `json:"total_avaliacoes,omitempty"`
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
	Status string `json:"status"`
}

// PlaceDetailsResponse representa a resposta do Place Details da Places API
type PlaceDetailsResponse struct {
	Result struct {
		Rating            float64 `json:"rating"`
		UserRatingsTotal  int     `json:"user_ratings_total"`
		Reviews           []Review `json:"reviews"`
	} `json:"result"`
	Status string `json:"status"`
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
func ScrapeGoogleReviews(nomeEmpresa string) (*GoogleData, error) {
	if nomeEmpresa == "" {
		log.Printf("⚠️  Google Reviews: Nome da empresa vazio, pulando extração")
		return nil, fmt.Errorf("nome da empresa vazio")
	}

	log.Printf("🔍 Iniciando extração de Google Reviews via API para: %s", nomeEmpresa)

	// A. Validar API Key
	apiKey := os.Getenv("GOOGLE_PLACES_API_KEY")
	if apiKey == "" {
		log.Printf("❌ Erro: GOOGLE_PLACES_API_KEY não configurada")
		return nil, fmt.Errorf("GOOGLE_PLACES_API_KEY não configurada")
	}

	// B. Text Search para obter place_id
	placeID, err := searchPlace(nomeEmpresa, apiKey)
	if err != nil {
		log.Printf("⚠️  Erro ao buscar place_id: %v", err)
		return nil, fmt.Errorf("erro ao buscar place_id: %w", err)
	}

	if placeID == "" {
		log.Printf("⚠️  Nenhum estabelecimento encontrado para: %s", nomeEmpresa)
		return nil, fmt.Errorf("estabelecimento não encontrado")
	}

	log.Printf("✓ Place ID encontrado: %s", placeID)

	// C. Place Details para obter rating, total de avaliações e reviews
	details, err := getPlaceDetails(placeID, apiKey)
	if err != nil {
		log.Printf("⚠️  Erro ao buscar detalhes do place: %v", err)
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
		log.Printf("⭐ Nota extraída: %s", googleData.NotaGeral)
	}

	// Converter total de avaliações para string
	if details.Result.UserRatingsTotal > 0 {
		googleData.TotalAvaliacoes = strconv.Itoa(details.Result.UserRatingsTotal)
		log.Printf("📊 Total de avaliações: %s", googleData.TotalAvaliacoes)
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
		log.Printf("💬 Comentários extraídos: %d", len(googleData.ComentariosRecentes))
	}

	log.Printf("✅ Google Reviews extraído com sucesso via API para: %s", nomeEmpresa)
	return googleData, nil
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

// searchPlace faz uma busca textual para encontrar o place_id
func searchPlace(query string, apiKey string) (string, error) {
	baseURL := "https://maps.googleapis.com/maps/api/place/textsearch/json"

	// Build query parameters
	params := url.Values{}
	params.Add("query", query)
	params.Add("key", apiKey)
	params.Add("language", "pt-BR")

	searchURL := fmt.Sprintf("%s?%s", baseURL, params.Encode())

	log.Printf("🌐 Fazendo Text Search na Google Places API...")

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
		log.Printf("⚠️  Google Places API retornou status: %s", searchResponse.Status)
		if searchResponse.Status == "ZERO_RESULTS" {
			return "", nil // Não é erro fatal, apenas não encontrou
		}
		return "", fmt.Errorf("API status: %s", searchResponse.Status)
	}

	// Return first result's place_id
	if len(searchResponse.Results) > 0 {
		log.Printf("✓ Encontrado: %s (place_id: %s)",
			searchResponse.Results[0].Name,
			searchResponse.Results[0].PlaceID)
		return searchResponse.Results[0].PlaceID, nil
	}

	return "", nil
}

// getPlaceDetails busca detalhes completos do lugar incluindo reviews
func getPlaceDetails(placeID string, apiKey string) (*PlaceDetailsResponse, error) {
	baseURL := "https://maps.googleapis.com/maps/api/place/details/json"

	// Build query parameters
	params := url.Values{}
	params.Add("place_id", placeID)
	params.Add("fields", "rating,user_ratings_total,reviews")
	params.Add("key", apiKey)
	params.Add("language", "pt-BR")

	detailsURL := fmt.Sprintf("%s?%s", baseURL, params.Encode())

	log.Printf("🌐 Fazendo Place Details na Google Places API...")

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
