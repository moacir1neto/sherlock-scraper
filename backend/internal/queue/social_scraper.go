package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/playwright-community/playwright-go"
)

// SocialData holds the deep intelligence extracted from social media
type SocialData struct {
	Bio           string
	LastPostDate  string
	RecentPosts   []string
	Success       bool
	ErrorMessage  string
}

// BusinessInsights holds structured business information extracted by AI
type BusinessInsights struct {
	BusinessType   string   `json:"business_type"`
	Services       []string `json:"services"`
	TargetAudience string   `json:"target_audience"`
	Tone           string   `json:"tone"`
	MarketingLevel string   `json:"marketing_level"`
	HasWhatsApp    bool     `json:"has_whatsapp"`
}

// Validate sanitizes and applies business rules to the extracted insights
func (b *BusinessInsights) Validate() {
	// 1. Sanitizar e validar BusinessType
	b.BusinessType = strings.TrimSpace(b.BusinessType)
	if len(b.BusinessType) > 200 {
		b.BusinessType = b.BusinessType[:200]
	}
	if len(b.BusinessType) < 3 {
		log.Printf("⚠️  [Validation] BusinessType muito curto ou vazio: '%s'", b.BusinessType)
	}

	// 2. Validar e filtrar Services
	var uniqueServices []string
	seen := make(map[string]bool)
	for _, s := range b.Services {
		s = strings.TrimSpace(s)
		if s != "" && !seen[s] && len(s) <= 200 {
			seen[s] = true
			uniqueServices = append(uniqueServices, s)
		}
		if len(uniqueServices) >= 5 {
			break
		}
	}
	b.Services = uniqueServices

	// 3. Validar MarketingLevel
	b.MarketingLevel = strings.ToLower(strings.TrimSpace(b.MarketingLevel))
	validLevels := map[string]bool{"baixo": true, "medio": true, "alto": true}
	if !validLevels[b.MarketingLevel] {
		log.Printf("⚠️  [Validation] MarketingLevel inválido ('%s'), usando fallback 'medio'", b.MarketingLevel)
		b.MarketingLevel = "medio"
	}

	// 4. Sanitizar demais campos
	b.TargetAudience = strings.TrimSpace(b.TargetAudience)
	if len(b.TargetAudience) > 200 {
		b.TargetAudience = b.TargetAudience[:200]
	}

	b.Tone = strings.TrimSpace(b.Tone)
	if len(b.Tone) > 200 {
		b.Tone = b.Tone[:200]
	}
}

// DeepDataStructure represents the JSONB structure for lead deep intelligence
type DeepDataStructure struct {
	Instagram *SocialPlatformData `json:"instagram,omitempty"`
	Facebook  *SocialPlatformData `json:"facebook,omitempty"`
	YouTube   *SocialPlatformData `json:"youtube,omitempty"`
	TikTok    *SocialPlatformData `json:"tiktok,omitempty"`
	Google    *GoogleData         `json:"google,omitempty"`
	Insights  *BusinessInsights   `json:"insights,omitempty"`
}

// SocialPlatformData holds data for a specific social platform
type SocialPlatformData struct {
	Bio          string   `json:"bio,omitempty"`
	LastPostDate string   `json:"last_post_date,omitempty"`
	Posts        []string `json:"posts,omitempty"`
	Followers    string   `json:"followers,omitempty"`
	Following    string   `json:"following,omitempty"`
}

// ScrapeInstagramProfile extracts bio and recent posts from Instagram
func ScrapeInstagramProfile(instagramURL string) *SocialData {
	data := &SocialData{Success: false}

	// Check if URL is valid
	if !strings.Contains(instagramURL, "instagram.com") {
		data.ErrorMessage = "URL inválida do Instagram"
		return data
	}

	log.Printf("🔍 Iniciando deep scraping do Instagram: %s", instagramURL)

	// Auto-install Playwright driver if needed
	errInstall := playwright.Install(&playwright.RunOptions{
		SkipInstallBrowsers: true, // Chromium já está instalado no sistema
	})
	if errInstall != nil {
		log.Printf("⚠️  Aviso: Falha ao instalar driver do Playwright: %v", errInstall)
	}

	// Initialize Playwright
	pw, err := playwright.Run()
	if err != nil {
		data.ErrorMessage = fmt.Sprintf("Falha ao iniciar Playwright: %v", err)
		log.Printf("⚠️  %s", data.ErrorMessage)
		return data
	}
	defer pw.Stop()

	// Launch browser in headless mode using system Chromium
	browser, err := pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless:       playwright.Bool(true),
		ExecutablePath: playwright.String("/usr/bin/chromium-browser"),
		Args: []string{
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage",
			"--disable-gpu",
		},
	})
	if err != nil {
		data.ErrorMessage = fmt.Sprintf("Falha ao lançar navegador: %v", err)
		log.Printf("⚠️  %s", data.ErrorMessage)
		return data
	}
	defer browser.Close()

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create new page
	page, err := browser.NewPage()
	if err != nil {
		data.ErrorMessage = fmt.Sprintf("Falha ao criar página: %v", err)
		log.Printf("⚠️  %s", data.ErrorMessage)
		return data
	}
	defer page.Close()

	// Navigate to Instagram profile
	if _, err := page.Goto(instagramURL, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateNetworkidle,
		Timeout:   playwright.Float(20000),
	}); err != nil {
		data.ErrorMessage = fmt.Sprintf("Timeout ao carregar perfil: %v", err)
		log.Printf("⚠️  %s", data.ErrorMessage)
		return data
	}

	// Wait a bit for dynamic content
	time.Sleep(2 * time.Second)

	// Check if login wall appeared
	if hasLoginWall(page) {
		log.Printf("⚠️  Instagram solicitou login - tentando extrair dados visíveis")
	}

	// Try to extract bio
	bio, err := extractInstagramBio(page, ctx)
	if err == nil && bio != "" {
		data.Bio = bio
		log.Printf("📝 Bio extraída: %.50s...", bio)
	}

	// Try to extract recent posts
	posts, lastPostDate := extractInstagramPosts(page, ctx)
	if len(posts) > 0 {
		data.RecentPosts = posts
		data.LastPostDate = lastPostDate
		log.Printf("📸 Posts extraídos: %d", len(posts))
	}

	// Mark as successful if we got at least some data
	if data.Bio != "" || len(data.RecentPosts) > 0 {
		data.Success = true
	} else {
		data.ErrorMessage = "Nenhum dado extraído (possível bloqueio)"
	}

	return data
}

// ScrapeFacebookPage extracts bio and recent posts from Facebook
func ScrapeFacebookPage(facebookURL string) *SocialData {
	data := &SocialData{Success: false}

	// Check if URL is valid
	if !strings.Contains(facebookURL, "facebook.com") && !strings.Contains(facebookURL, "fb.com") {
		data.ErrorMessage = "URL inválida do Facebook"
		return data
	}

	log.Printf("🔍 Iniciando deep scraping do Facebook: %s", facebookURL)

	// Auto-install Playwright driver if needed
	errInstall := playwright.Install(&playwright.RunOptions{
		SkipInstallBrowsers: true, // Chromium já está instalado no sistema
	})
	if errInstall != nil {
		log.Printf("⚠️  Aviso: Falha ao instalar driver do Playwright: %v", errInstall)
	}

	// Initialize Playwright
	pw, err := playwright.Run()
	if err != nil {
		data.ErrorMessage = fmt.Sprintf("Falha ao iniciar Playwright: %v", err)
		log.Printf("⚠️  %s", data.ErrorMessage)
		return data
	}
	defer pw.Stop()

	// Launch browser using system Chromium
	browser, err := pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless:       playwright.Bool(true),
		ExecutablePath: playwright.String("/usr/bin/chromium-browser"),
		Args: []string{
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage",
			"--disable-gpu",
		},
	})
	if err != nil {
		data.ErrorMessage = fmt.Sprintf("Falha ao lançar navegador: %v", err)
		log.Printf("⚠️  %s", data.ErrorMessage)
		return data
	}
	defer browser.Close()

	// Create context
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create page
	page, err := browser.NewPage()
	if err != nil {
		data.ErrorMessage = fmt.Sprintf("Falha ao criar página: %v", err)
		log.Printf("⚠️  %s", data.ErrorMessage)
		return data
	}
	defer page.Close()

	// Navigate to Facebook page
	if _, err := page.Goto(facebookURL, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateNetworkidle,
		Timeout:   playwright.Float(20000),
	}); err != nil {
		data.ErrorMessage = fmt.Sprintf("Timeout ao carregar página: %v", err)
		log.Printf("⚠️  %s", data.ErrorMessage)
		return data
	}

	// Wait for content
	time.Sleep(2 * time.Second)

	// Check for login wall
	if hasLoginWall(page) {
		log.Printf("⚠️  Facebook solicitou login - tentando extrair dados visíveis")
	}

	// Try to extract about/bio
	bio, err := extractFacebookBio(page, ctx)
	if err == nil && bio != "" {
		data.Bio = bio
		log.Printf("📝 Bio extraída: %.50s...", bio)
	}

	// Try to extract recent posts
	posts, lastPostDate := extractFacebookPosts(page, ctx)
	if len(posts) > 0 {
		data.RecentPosts = posts
		data.LastPostDate = lastPostDate
		log.Printf("📄 Posts extraídos: %d", len(posts))
	}

	if data.Bio != "" || len(data.RecentPosts) > 0 {
		data.Success = true
	} else {
		data.ErrorMessage = "Nenhum dado extraído (possível bloqueio)"
	}

	return data
}

// hasLoginWall checks if a login wall is present
func hasLoginWall(page playwright.Page) bool {
	// Check for common login indicators
	selectors := []string{
		"input[name='username']",
		"input[name='email']",
		"input[type='password']",
		"button[type='submit']",
	}

	for _, selector := range selectors {
		if elem, _ := page.QuerySelector(selector); elem != nil {
			return true
		}
	}

	return false
}

// extractInstagramBio extracts bio from Instagram profile
func extractInstagramBio(page playwright.Page, ctx context.Context) (string, error) {
	// Try different selectors for bio
	selectors := []string{
		"header section div",
		"span._ap3a._aaco._aacu._aacx._aad7._aade",
		"div.-vDIg span",
	}

	for _, selector := range selectors {
		if elem, err := page.QuerySelector(selector); err == nil && elem != nil {
			if text, err := elem.TextContent(); err == nil && text != "" {
				// Clean up the text
				text = strings.TrimSpace(text)
				if len(text) > 10 && len(text) < 500 {
					return text, nil
				}
			}
		}
	}

	return "", fmt.Errorf("bio não encontrada")
}

// extractInstagramPosts extracts recent posts from Instagram
func extractInstagramPosts(page playwright.Page, ctx context.Context) ([]string, string) {
	posts := []string{}
	lastPostDate := ""

	// Try to find post links
	articles, err := page.QuerySelectorAll("article a[href*='/p/']")
	if err != nil || len(articles) == 0 {
		return posts, lastPostDate
	}

	// Limit to first 3 posts
	limit := 3
	if len(articles) < limit {
		limit = len(articles)
	}

	for i := 0; i < limit; i++ {
		if img, err := articles[i].QuerySelector("img"); err == nil && img != nil {
			if alt, err := img.GetAttribute("alt"); err == nil && alt != "" {
				posts = append(posts, alt)
			}
		}
	}

	// Try to extract timestamp
	if time, err := page.QuerySelector("time"); err == nil && time != nil {
		if datetime, err := time.GetAttribute("datetime"); err == nil {
			lastPostDate = datetime
		}
	}

	return posts, lastPostDate
}

// extractFacebookBio extracts bio/about from Facebook page
func extractFacebookBio(page playwright.Page, ctx context.Context) (string, error) {
	// Try different selectors
	selectors := []string{
		"div[data-ad-preview='message']",
		"div.x1iorvi4.x1pi30zi.x1l90r2v.x1swvt13",
		"span.x193iq5w",
	}

	for _, selector := range selectors {
		if elem, err := page.QuerySelector(selector); err == nil && elem != nil {
			if text, err := elem.TextContent(); err == nil && text != "" {
				text = strings.TrimSpace(text)
				if len(text) > 10 && len(text) < 500 {
					return text, nil
				}
			}
		}
	}

	return "", fmt.Errorf("bio não encontrada")
}

// extractFacebookPosts extracts recent posts from Facebook page
func extractFacebookPosts(page playwright.Page, ctx context.Context) ([]string, string) {
	posts := []string{}
	lastPostDate := ""

	// Try to find post containers
	postContainers, err := page.QuerySelectorAll("div[data-ad-preview='message']")
	if err != nil || len(postContainers) == 0 {
		return posts, lastPostDate
	}

	// Limit to first 3 posts
	limit := 3
	if len(postContainers) < limit {
		limit = len(postContainers)
	}

	for i := 0; i < limit; i++ {
		if text, err := postContainers[i].TextContent(); err == nil && text != "" {
			text = strings.TrimSpace(text)
			if len(text) > 0 {
				posts = append(posts, text)
			}
		}
	}

	return posts, lastPostDate
}

// FormatPostsAsJSON converts posts array to JSON string
func FormatPostsAsJSON(posts []string) string {
	if len(posts) == 0 {
		return "[]"
	}

	jsonData, err := json.Marshal(posts)
	if err != nil {
		return "[]"
	}

	return string(jsonData)
}
