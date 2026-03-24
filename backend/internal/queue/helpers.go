package queue

import (
	"regexp"
	"strings"
)

// EnrichmentData holds the data extracted from website
type EnrichmentData struct {
	Instagram string
	Facebook  string
	TemPixel  bool
	TemGTM    bool
}

// ExtractSocialAndTracking extracts social media links and tracking scripts from HTML
func ExtractSocialAndTracking(htmlBody string) *EnrichmentData {
	data := &EnrichmentData{}

	// Extract Instagram
	data.Instagram = extractInstagram(htmlBody)

	// Extract Facebook
	data.Facebook = extractFacebook(htmlBody)

	// Check for Facebook Pixel
	data.TemPixel = detectFacebookPixel(htmlBody)

	// Check for Google Tag Manager
	data.TemGTM = detectGoogleTagManager(htmlBody)

	return data
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
			if isCommonFacebookPath(pageName) {
				continue
			}
			// Remove trailing slashes or quotes
			pageName = strings.TrimRight(pageName, `/"'`)
			return "https://facebook.com/" + pageName
		}
	}

	return ""
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
