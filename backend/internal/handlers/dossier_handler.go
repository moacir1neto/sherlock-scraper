package handlers

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/config"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/logger"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/database"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/queue"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/valyala/fasthttp"
	"go.uber.org/zap"
)

// DossierHandler expõe dois endpoints para o pipeline de deep research de lead:
//   - POST /api/v1/leads/:id/dossier       — enfileira dossier:analyze no Asynq
//   - GET  /api/v1/leads/:id/dossier/stream — SSE via Redis Pub/Sub dossier:logs:<id>
type DossierHandler struct{}

// NewDossierHandler cria o handler.
func NewDossierHandler() *DossierHandler {
	return &DossierHandler{}
}

// Enqueue enfileira o pipeline dossier:analyze para o lead especificado.
//
// POST /api/v1/leads/:id/dossier
func (h *DossierHandler) Enqueue(c *fiber.Ctx) error {
	leadID := c.Params("id")
	if leadID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "lead id é obrigatório",
		})
	}

	if err := database.DB.Where("lead_id = ?", leadID).Delete(&domain.LeadDossier{}).Error; err != nil {
		logger.FromContext(c.UserContext()).Warn("falha_limpar_cache_dossie", zap.String("lead_id", leadID), zap.Error(err))
	}

	task, err := queue.NewDossierAnalyzeTask(leadID)
	if err != nil {
		logger.FromContext(c.UserContext()).Error("falha_criar_task_dossier", zap.String("lead_id", leadID), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "falha ao criar task de dossier",
		})
	}

	info, err := queue.Client.Enqueue(task)
	if err != nil {
		logger.FromContext(c.UserContext()).Error("falha_enfileirar_task_dossier", zap.String("lead_id", leadID), zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "falha ao enfileirar dossier:analyze",
		})
	}

	logger.FromContext(c.UserContext()).Info("dossier_task_enfileirada", zap.String("lead_id", leadID), zap.String("task_id", info.ID))

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"message": "pipeline dossier:analyze enfileirado",
		"lead_id": leadID,
		"task_id": info.ID,
	})
}

// Stream retransmite os eventos de progresso do pipeline via SSE.
//
// GET /api/v1/leads/:id/dossier/stream
func (h *DossierHandler) Stream(c *fiber.Ctx) error {
	leadID := c.Params("id")
	if leadID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "lead id é obrigatório",
		})
	}

	channel := queue.DossierLogChannel(leadID)

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	c.Context().SetBodyStreamWriter(fasthttp.StreamWriter(func(w *bufio.Writer) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Cada conexão SSE usa seu próprio client Redis — go-redis entra em modo
		// Pub/Sub exclusivo na conexão, impedindo outros comandos.
		redisClient := newDossierRedisClient()
		defer redisClient.Close()

		pubsub := redisClient.Subscribe(ctx, channel)
		defer func() {
			if err := pubsub.Close(); err != nil {
				log.Printf("[DossierSSE] ⚠️  Erro ao fechar pubsub: %v", err)
			}
		}()

		if _, err := pubsub.Receive(ctx); err != nil {
			log.Printf("[DossierSSE] ⚠️  Erro ao confirmar subscrição: %v", err)
			return
		}

		log.Printf("[DossierSSE] 📡 Cliente conectado (lead=%s)", leadID)

		msgCh := make(chan string, 16)
		go func() {
			defer close(msgCh)
			for {
				msg, err := pubsub.ReceiveMessage(ctx)
				if err != nil {
					return
				}
				select {
				case msgCh <- msg.Payload:
				case <-ctx.Done():
					return
				}
			}
		}()

		fmt.Fprintf(w, ": connected\n\n")
		if err := w.Flush(); err != nil {
			return
		}

		heartbeat := time.NewTicker(30 * time.Second)
		defer heartbeat.Stop()

		for {
			select {
			case data, ok := <-msgCh:
				if !ok {
					return
				}
				fmt.Fprintf(w, "data: %s\n\n", data)
				if err := w.Flush(); err != nil {
					return
				}

			case <-heartbeat.C:
				fmt.Fprintf(w, ": heartbeat\n\n")
				if err := w.Flush(); err != nil {
					return
				}
			}
		}
	}))

	return nil
}

// newDossierRedisClient cria um client go-redis dedicado para o subscriber SSE do dossier.
func newDossierRedisClient() *redis.Client {
	addr := config.Get().RedisURL
	if addr == "" {
		addr = "localhost:6379"
	}
	return redis.NewClient(&redis.Options{
		Addr:         addr,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  0, // Sem timeout para Pub/Sub blocking
		WriteTimeout: 3 * time.Second,
	})
}
