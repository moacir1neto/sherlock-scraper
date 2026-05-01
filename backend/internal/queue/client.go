package queue

import (
	"log"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/config"
	"github.com/hibiken/asynq"
)

var Client *asynq.Client

// InitClient initializes the Asynq client
func InitClient() {
	redisAddr := config.Get().RedisURL
	if redisAddr == "" {
		redisAddr = "localhost:6379" // Default if not provided
	}

	Client = asynq.NewClient(asynq.RedisClientOpt{Addr: redisAddr})
	log.Printf("Asynq client initialized pointing to %s", redisAddr)
}

// CloseClient closes the Asynq client
func CloseClient() {
	if Client != nil {
		if err := Client.Close(); err != nil {
			log.Printf("Error closing Asynq client: %v", err)
		}
	}
}
