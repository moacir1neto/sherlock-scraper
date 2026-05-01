package config

import (
	"log"
	"os"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type environment struct {
	DatabaseURL string `env:"DATABASE_URL"`
	RedisURL    string `env:"REDIS_URL"`
	JWTSecret   string `env:"JWT_SECRET"`

	GeminiAPIKey       string `env:"GEMINI_API_KEY"`
	GooglePlacesAPIKey string `env:"GOOGLE_PLACES_API_KEY"`

	WhatsmeowURL      string `env:"WHATSMEOW_URL" envDefault:"http://whatsmeow:8080"`
	WhatsmeowAPIToken string `env:"INTERNAL_API_TOKEN"`

	Port string `env:"PORT" envDefault:"3000"`
}

var instance environment

// Get retorna a instância de configuração
func Get() environment {
	return instance
}

func (e *environment) validate() {
	missing := false

	if e.DatabaseURL == "" {
		log.Println("ERRO: DATABASE_URL é obrigatória")
		missing = true
	}
	if e.RedisURL == "" {
		log.Println("ERRO: REDIS_URL é obrigatória")
		missing = true
	}
	if e.JWTSecret == "" {
		log.Println("ERRO: JWT_SECRET é obrigatória")
		missing = true
	}

	if missing {
		log.Fatal("Falha no startup do backend: Variáveis de ambiente obrigatórias ausentes.")
	}

	// Avisos para variáveis opcionais
	if e.GeminiAPIKey == "" {
		log.Println("AVISO: GEMINI_API_KEY não configurada. Funcionalidades de IA estarão desativadas.")
	}
	if e.GooglePlacesAPIKey == "" {
		log.Println("AVISO: GOOGLE_PLACES_API_KEY não configurada. O enriquecimento de leads via Google Maps estará desativado.")
	}
}

func Load() {
	if os.Getenv("APP_ENV") != "production" {
		if err := godotenv.Load(".env"); err != nil {
			log.Println("Aviso: Arquivo .env não encontrado no backend, usando variáveis do sistema.")
		}
	}

	if err := env.Parse(&instance); err != nil {
		log.Fatalf("Erro ao parsear variáveis de ambiente no backend: %v", err)
	}

	instance.validate()
}
