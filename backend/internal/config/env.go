package config

import (
	"fmt"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Environment struct {
	DatabaseURL string `env:"DATABASE_URL"`
	RedisURL    string `env:"REDIS_URL"`
	JWTSecret   string `env:"JWT_SECRET"`

	// Other non-critical or optional envs can go here if needed.
	// For now we map what's strictly required by the contract.
	// External API Keys (Optional at startup but required for specific features)
	GeminiAPIKey       string `env:"GEMINI_API_KEY"`
	GooglePlacesAPIKey string `env:"GOOGLE_PLACES_API_KEY"`

	// WhatsMiau Service Integration
	WhatsmeowURL      string `env:"WHATSMEOW_URL" envDefault:"http://whatsmeow:8080"`
	WhatsmeowAPIToken string `env:"INTERNAL_API_TOKEN"` // Matches WhatsmeowAPIKey or WHATSMIau_API_TOKEN uses

	Port string `env:"PORT" envDefault:"3000"`
}

var Env Environment

func (e *Environment) Validate() error {
	if e.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	if e.RedisURL == "" {
		return fmt.Errorf("REDIS_URL is required")
	}
	if e.JWTSecret == "" {
		return fmt.Errorf("JWT_SECRET is required")
	}
	return nil
}

func Load() error {
	_ = godotenv.Load(".env")
	err := env.Parse(&Env)
	if err != nil {
		return err
	}
	return Env.Validate()
}
