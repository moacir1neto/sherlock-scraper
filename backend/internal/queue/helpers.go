package queue

import (
	"regexp"
	"strings"
)

// WebsiteData holds the data extracted from website
type WebsiteData struct {
	Emails       []string          `json:"emails"`
	Phones       []string          `json:"phones"`
	SocialLinks  map[string]string `json:"social_links"`
	PagesVisited []string          `json:"pages_visited"`
	RawText      string            `json:"raw_text"`
	Instagram    string            `json:"instagram"`
	Facebook     string            `json:"facebook"`
	TemPixel     bool              `json:"tem_pixel"`
	TemGTM       bool              `json:"tem_gtm"`
}

// ExtractWebsiteData extracts social media links, tracking scripts, emails, and phones from HTML
func ExtractWebsiteData(htmlBody string) *WebsiteData {
	data := &WebsiteData{
		SocialLinks: make(map[string]string),
	}

	// Extract Instagram
	data.Instagram = extractInstagram(htmlBody)
	if data.Instagram != "" {
		data.SocialLinks["instagram"] = data.Instagram
	}

	// Extract Facebook
	data.Facebook = extractFacebook(htmlBody)
	if data.Facebook != "" {
		data.SocialLinks["facebook"] = data.Facebook
	}

	// Extract other social links
	extractOtherSocialLinks(htmlBody, data.SocialLinks)

	// Check for Facebook Pixel
	data.TemPixel = detectFacebookPixel(htmlBody)

	// Check for Google Tag Manager
	data.TemGTM = detectGoogleTagManager(htmlBody)

	// Extract Emails
	data.Emails = extractEmails(htmlBody)

	// Extract Phones
	data.Phones = extractPhones(htmlBody)

	// Extract Raw Text
	data.RawText = extractRawText(htmlBody)

	return data
}

// extractEmails uses a robust regex to find emails in HTML
func extractEmails(html string) []string {
	re := regexp.MustCompile(`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`)
	matches := re.FindAllString(html, -1)
	return uniqueStrings(matches)
}

// extractPhones finds Brazilian format phones
func extractPhones(html string) []string {
	// BR Phone formats: (11) 99999-9999, 11 99999-9999, 11999999999, etc.
	re := regexp.MustCompile(`(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-\s]?\d{4}`)
	matches := re.FindAllString(html, -1)

	var cleaned []string
	for _, m := range matches {
		// Basic cleaning to avoid garbage
		c := strings.Map(func(r rune) rune {
			if r >= '0' && r <= '9' {
				return r
			}
			return -1
		}, m)
		if len(c) >= 10 && len(c) <= 11 {
			cleaned = append(cleaned, m) // Keep original format for display or normalize later
		}
	}
	return uniqueStrings(cleaned)
}

// extractOtherSocialLinks finds LinkedIn, WhatsApp, etc.
func extractOtherSocialLinks(html string, links map[string]string) {
	patterns := map[string]string{
		"linkedin": `https?://(?:www\.)?linkedin\.com/(?:company|in)/[a-zA-Z0-9._-]+`,
		"whatsapp": `https?://(?:api|web|wa)\.whatsapp\.com/send\?phone=\d+`,
		"youtube":  `https?://(?:www\.)?youtube\.com/(?:channel|user|c)/[a-zA-Z0-9._-]+`,
	}

	for key, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		match := re.FindString(html)
		if match != "" {
			links[key] = match
		}
	}
}

// extractRawText removes scripts, styles and returns clean text
func extractRawText(html string) string {
	// Simple approach: remove <script> and <style> tags and their content
	reScript := regexp.MustCompile(`(?s)<script.*?>.*?</script>`)
	reStyle := regexp.MustCompile(`(?s)<style.*?>.*?</style>`)
	reTags := regexp.MustCompile(`<.*?>`)

	text := reScript.ReplaceAllString(html, " ")
	text = reStyle.ReplaceAllString(text, " ")
	text = reTags.ReplaceAllString(text, " ")

	// Clean up whitespace
	lines := strings.Split(text, "\n")
	var cleaned []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			cleaned = append(cleaned, trimmed)
		}
	}

	result := strings.Join(cleaned, " ")
	if len(result) > 5000 {
		result = result[:5000] // Limit size
	}
	return result
}

// uniqueStrings removes duplicates from a string slice
func uniqueStrings(input []string) []string {
	unique := make(map[string]bool)
	var result []string
	for _, s := range input {
		s = strings.TrimSpace(s)
		if s != "" && !unique[s] {
			unique[s] = true
			result = append(result, s)
		}
	}
	return result
}

// extractInstagram finds Instagram URLs in HTML
func extractInstagram(html string) string {
	// Patterns for Instagram URLs
	patterns := []string{
		`https?://(?:www\.)?instagram\.com/([a-zA-Z0-9._]+)/?`,
		`instagram\.com/([a-zA-Z0-9._]+)`,
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(html)
		if len(matches) > 1 {
			username := matches[1]
			// Remove trailing slashes or quotes
			username = strings.TrimRight(username, `/"'`)
			if isCommonSocialPath(username) {
				continue
			}
			return "https://instagram.com/" + username
		}
	}

	return ""
}

// extractFacebook finds Facebook URLs in HTML
func extractFacebook(html string) string {
	// Patterns for Facebook URLs
	patterns := []string{
		`https?://(?:www\.)?facebook\.com/([a-zA-Z0-9._-]+)/?`,
		`facebook\.com/([a-zA-Z0-9._-]+)`,
		`https?://(?:www\.)?fb\.com/([a-zA-Z0-9._-]+)/?`,
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(html)
		if len(matches) > 1 {
			pageName := matches[1]
			// Ignore common non-page paths
			if isCommonFacebookPath(pageName) || isCommonSocialPath(pageName) {
				continue
			}
			// Remove trailing slashes or quotes
			pageName = strings.TrimRight(pageName, `/"'`)
			return "https://facebook.com/" + pageName
		}
	}

	return ""
}

func isCommonSocialPath(path string) bool {
	paths := []string{"explore", "reels", "p", "direct", "stories"}
	p := strings.ToLower(path)
	for _, v := range paths {
		if p == v {
			return true
		}
	}
	return false
}

// isCommonFacebookPath checks if the path is a common Facebook system path
func isCommonFacebookPath(path string) bool {
	commonPaths := []string{
		"sharer", "plugins", "dialog", "tr", "login",
		"logout", "privacy", "policy", "help", "about",
	}

	pathLower := strings.ToLower(path)
	for _, common := range commonPaths {
		if strings.Contains(pathLower, common) {
			return true
		}
	}

	return false
}

// detectFacebookPixel checks if Facebook Pixel is present in HTML
func detectFacebookPixel(html string) bool {
	pixelSignatures := []string{
		"fbevents.js",
		"facebook-jssdk",
		"fbq(",
		"_fbq",
		"facebook pixel",
	}

	htmlLower := strings.ToLower(html)
	for _, signature := range pixelSignatures {
		if strings.Contains(htmlLower, signature) {
			return true
		}
	}

	return false
}

// detectGoogleTagManager checks if Google Tag Manager is present in HTML
func detectGoogleTagManager(html string) bool {
	gtmSignatures := []string{
		"gtm.js",
		"googletagmanager.com",
		"google tag manager",
		"dataLayer",
		"GTM-",
	}

	htmlLower := strings.ToLower(html)
	for _, signature := range gtmSignatures {
		if strings.Contains(htmlLower, signature) {
			return true
		}
	}

	return false
}

// ExtractInternalLinks finds all same-domain links in HTML
func ExtractInternalLinks(html, baseURL string) []string {
	re := regexp.MustCompile(`href=["']([^"']+)["']`)
	matches := re.FindAllStringSubmatch(html, -1)

	domain := getDomain(baseURL)
	var links []string
	for _, m := range matches {
		link := m[1]
		normalized := normalizeURL(link, baseURL)
		if normalized != "" && getDomain(normalized) == domain {
			links = append(links, normalized)
		}
	}
	return uniqueStrings(links)
}

func getDomain(u string) string {
	u = strings.TrimPrefix(u, "http://")
	u = strings.TrimPrefix(u, "https://")
	u = strings.Split(u, "/")[0]
	return strings.TrimPrefix(u, "www.")
}

func normalizeURL(link, baseURL string) string {
	if strings.HasPrefix(link, "javascript:") || strings.HasPrefix(link, "mailto:") || strings.HasPrefix(link, "tel:") || strings.HasPrefix(link, "#") {
		return ""
	}

	if strings.HasPrefix(link, "//") {
		return "https:" + link
	}

	if strings.HasPrefix(link, "/") {
		base := baseURL
		if strings.HasSuffix(base, "/") {
			base = base[:len(base)-1]
		}
		// If base is just https://domain.com (no trailing slash handled above),
		// we need to be careful if baseURL already has a path.
		// For simplicity, let's just get the origin.
		if parts := strings.Split(baseURL, "/"); len(parts) >= 3 {
			origin := parts[0] + "//" + parts[2]
			return origin + link
		}
		return base + link
	}

	if !strings.HasPrefix(link, "http") {
		return "" // Skip relative paths for now or implement better joining
	}

	return link
}

// PrioritizeLinks selects up to 3 links based on keywords
func PrioritizeLinks(links []string) []string {
	keywords := []string{"contato", "contact", "sobre", "about", "empresa", "servicos", "services"}
	var prioritized []string

	// First pass: find keyword matches
	for _, link := range links {
		linkLower := strings.ToLower(link)
		for _, kw := range keywords {
			if strings.Contains(linkLower, kw) {
				prioritized = append(prioritized, link)
				break
			}
		}
		if len(prioritized) >= 3 {
			return prioritized
		}
	}

	// Second pass: fill with remaining links if less than 3
	if len(prioritized) < 3 {
		for _, link := range links {
			isAlreadyAdded := false
			for _, p := range prioritized {
				if p == link {
					isAlreadyAdded = true
					break
				}
			}
			if !isAlreadyAdded {
				prioritized = append(prioritized, link)
			}
			if len(prioritized) >= 3 {
				break
			}
		}
	}

	return prioritized
}
