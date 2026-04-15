package queue

import (
	"log"
	"os"

	"github.com/hibiken/asynq"
)

// StartServer starts the Asynq server and registers handlers
func StartServer() {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379" // Default if not provided
	}

	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: redisAddr},
		asynq.Config{
			Concurrency: 5,
			Queues: map[string]int{
				"critical": 6,
				"default":  3,
				"low":      1,
			},
		},
	)

	mux := asynq.NewServeMux()
	
	// Register task handlers here
	mux.HandleFunc(TaskTypeEnrichLead, HandleEnrichLeadTask)
	mux.HandleFunc(TaskTypeBulkMessage, HandleBulkMessageTask)
	mux.HandleFunc(TaskTypeDossierAnalyze, HandleDossierAnalyzeTask)

	log.Printf("Asynq server initialized pointing to %s", redisAddr)

	if err := srv.Run(mux); err != nil {
		log.Fatalf("Could not start Asynq server: %v", err)
	}
}
