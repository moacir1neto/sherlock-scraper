package queue

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/hibiken/asynq"
)

// StartServer starts the Asynq server and registers handlers
func StartServer() {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379" // Default if not provided
	}

	// 1. Configurar fila dedicada no Asynq com baixa concorrência
	// Servidor principal para tarefas normais
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

	// Servidor dedicado para CNPJ (baixa concorrência: 2 workers)
	cnpjSrv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: redisAddr},
		asynq.Config{
			Concurrency: 2, // Protege CPU/RAM e evita IP blocks
			Queues: map[string]int{
				"cnpj": 1,
			},
		},
	)

	mux := asynq.NewServeMux()
	
	// 3. Adicionar rate limiting: Máximo de X execuções por minuto
	mux.Use(rateLimitMiddleware)

	// Register task handlers
	mux.HandleFunc(TaskTypeEnrichLead, HandleEnrichLeadTask)
	mux.HandleFunc(TaskTypeBulkMessage, HandleBulkMessageTask)
	mux.HandleFunc(TaskTypeDossierAnalyze, HandleDossierAnalyzeTask)
	mux.HandleFunc(TaskTypeEnrichCNPJ, HandleEnrichCNPJTask)

	log.Printf("Asynq servers initialized pointing to %s (Main Concurrency: 5, CNPJ Concurrency: 2)", redisAddr)

	// Rodar servidores em paralelo
	go func() {
		if err := cnpjSrv.Run(mux); err != nil {
			log.Fatalf("Could not start Asynq CNPJ server: %v", err)
		}
	}()

	if err := srv.Run(mux); err != nil {
		log.Fatalf("Could not start Asynq main server: %v", err)
	}
}

// rateLimitMiddleware implementa o controle de taxa (5/min) para enriquecimento de CNPJ
func rateLimitMiddleware(next asynq.Handler) asynq.Handler {
	return asynq.HandlerFunc(func(ctx context.Context, t *asynq.Task) error {
		if t.Type() != TaskTypeEnrichCNPJ {
			return next.ProcessTask(ctx, t)
		}

		// Usamos o RedisPublisher (go-redis) para garantir que o limite seja global entre instâncias
		if RedisPublisher != nil {
			key := "ratelimit:enrich:cnpj"
			limit := 5 // Configurável conforme necessidade
			
			val, err := RedisPublisher.Incr(ctx, key).Result()
			if err == nil {
				if val == 1 {
					RedisPublisher.Expire(ctx, key, 1*time.Minute)
				}
				if val > int64(limit) {
					log.Printf("⏳ [RateLimit] enrich:cnpj excedeu limite (%d/min). Aguardando retry...", limit)
					// Retornamos erro comum para disparar o backoff exponencial do Asynq
					return fmt.Errorf("rate limit exceeded: %d/min limit reached", limit)
				}
			}
		}

		return next.ProcessTask(ctx, t)
	})
}
