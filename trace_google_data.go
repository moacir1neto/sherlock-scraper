package main

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
)

type GoogleData struct {
	NotaGeral          string   `json:"nota_geral,omitempty"`
	TotalAvaliacoes    string   `json:"total_avaliacoes,omitempty"`
	ComentariosRecentes []string `json:"comentarios_recentes,omitempty"`
}

type SocialPlatformData struct {
	Bio          string   `json:"bio,omitempty"`
	LastPostDate string   `json:"last_post_date,omitempty"`
	Posts        []string `json:"posts,omitempty"`
	Followers    string   `json:"followers,omitempty"`
	Following    string   `json:"following,omitempty"`
}

type BusinessInsights struct {
	BusinessType   string   `json:"business_type"`
	Services       []string `json:"services"`
	TargetAudience string   `json:"target_audience"`
	Tone           string   `json:"tone"`
	MarketingLevel string   `json:"marketing_level"`
	HasWhatsApp    bool     `json:"has_whatsapp"`
}

type DeepDataStructure struct {
	Instagram *SocialPlatformData `json:"instagram,omitempty"`
	Facebook  *SocialPlatformData `json:"facebook,omitempty"`
	YouTube   *SocialPlatformData `json:"youtube,omitempty"`
	TikTok    *SocialPlatformData `json:"tiktok,omitempty"`
	Google    *GoogleData         `json:"google,omitempty"`
	Insights  *BusinessInsights   `json:"insights,omitempty"`
}

type dossierAggregated struct {
	Google    *GoogleData      `json:"google,omitempty"`
	Insights *BusinessInsights `json:"insights,omitempty"`
	RawText  string            `json:"-"`
}

type Lead struct {
	Rating        string
	QtdAvaliacoes string
	DeepData      []byte
}

func main() {
	// Scenario: Lead has rating/reviews from another source (CRM or legacy), 
	// and deep_data has Google Data.

	lead := &Lead{
		Rating:        "0", // maybe 0 from CRM
		QtdAvaliacoes: "0",
		DeepData:      []byte(`{"google":{"nota_geral":"4,8","total_avaliacoes":"71"}, "insights":{"business_type":"teste"}}`),
	}

	agg := &dossierAggregated{}

	// loadPreEnrichedData logic
	var deepData DeepDataStructure
	err := json.Unmarshal(lead.DeepData, &deepData)
	if err != nil {
		log.Fatalf("unmarshal error: %v", err)
	}

	fmt.Println("=== 3. How it is loaded into the aggregation layer (agg.Google) ===")
	if deepData.Google != nil {
		agg.Google = deepData.Google
		fmt.Printf("Parsed agg.Google.NotaGeral = %q\n", agg.Google.NotaGeral)
		fmt.Printf("Parsed agg.Google.TotalAvaliacoes = %q\n", agg.Google.TotalAvaliacoes)
	}

	fmt.Println("\n=== 4. EXACT values BEFORE buildDossierPrompt ===")
	fmt.Printf("agg.Google.NotaGeral = %q\n", agg.Google.NotaGeral)
	fmt.Printf("agg.Google.TotalAvaliacoes = %q\n", agg.Google.TotalAvaliacoes)
	fmt.Printf("lead.Rating = %q\n", lead.Rating)
	fmt.Printf("lead.QtdAvaliacoes = %q\n", lead.QtdAvaliacoes)

	// buildDossierPrompt logic
	fmt.Println("\n=== 5. Values actually used INSIDE buildDossierPrompt ===")
	nota := lead.Rating
	avaliacoes := lead.QtdAvaliacoes
	if agg.Google != nil {
		if agg.Google.NotaGeral != "" && agg.Google.NotaGeral != "0.0" {
			nota = agg.Google.NotaGeral
		}
		if agg.Google.TotalAvaliacoes != "" && agg.Google.TotalAvaliacoes != "0" {
			avaliacoes = agg.Google.TotalAvaliacoes
		}
	}

	fmt.Printf("After override from agg.Google:\n")
	fmt.Printf("  nota = %q\n", nota)
	fmt.Printf("  avaliacoes = %q\n", avaliacoes)

	notaValida := nota != "" && nota != "-" && nota != "0.0" && nota != "0"
	avaliacoesValidas := avaliacoes != "" && avaliacoes != "0"

	fmt.Printf("\nValidation logic:\n")
	fmt.Printf("  notaValida = %v\n", notaValida)
	fmt.Printf("  avaliacoesValidas = %v\n", avaliacoesValidas)

	var sb strings.Builder
	if notaValida || avaliacoesValidas {
		if notaValida {
			fmt.Fprintf(&sb, "✅ Nota Google Maps: %s (%s avaliações)\n", nota, avaliacoes)
		} else {
			fmt.Fprintf(&sb, "✅ Google Maps: %s avaliações (sem nota registrada)\n", avaliacoes)
		}
	} else {
		sb.WriteString("⚠️ Google Maps: sem avaliações ou não encontrado\n")
	}

	fmt.Println("\n=== 6. Final string sent to LLM ===")
	fmt.Print(sb.String())
}
