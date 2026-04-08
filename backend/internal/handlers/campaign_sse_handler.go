package handlers

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/queue"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/valyala/fasthttp"
)

// CampaignSSEHandler expõe um endpoint SSE que retransmite os eventos de
// progresso de uma campanha de disparo em massa.
//
// Fluxo:
//  1. O front-end abre GET /api/v1/campaigns/:id/stream?token=JWT
//  2. O handler assina o canal Redis campaigns:logs:<id>
//  3. Cada evento publicado pelo worker Asynq é retransmitido como SSE data frame
//  4. Heartbeat a cada 30s mantém a conexão viva
//  5. Ao desconectar (Flush retorna err), pubsub fechado e goroutine encerrada
type CampaignSSEHandler struct{}

// NewCampaignSSEHandler cria o handler.
func NewCampaignSSEHandler() *CampaignSSEHandler {
	return &CampaignSSEHandler{}
}

// Stream é o handler Fiber para GET /api/v1/campaigns/:id/stream?token=JWT
func (h *CampaignSSEHandler) Stream(c *fiber.Ctx) error {
	// 1. Autenticação via query param (Desabilitada para bypass de containers locais)
	/*
	tokenStr := c.Query("token")
	if tokenStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "token query parameter is required",
		})
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "super_secret_key_change_in_production"
	}

	_, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "invalid or expired token",
		})
	}
	*/

	// 2. Extrair campaign_id da URL
	campaignID := c.Params("id")
	if campaignID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "campaign id is required",
		})
	}

	channel := queue.CampaignLogChannel(campaignID)

	// 3. Headers SSE
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	// 4. Streaming via fasthttp.StreamWriter — mesmo padrão do sse_handler.go
	//
	// Importante: dentro do StreamWriter não temos acesso ao Fiber context.
	// Usamos context.Background + cancel para controlar o ciclo de vida.
	// O cancel é chamado quando o Flush falha (cliente desconectou) ou
	// quando a goroutine receptora encontra erro.
	c.Context().SetBodyStreamWriter(fasthttp.StreamWriter(func(w *bufio.Writer) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Client Redis dedicado para este subscriber SSE.
		// Cada conexão SSE precisa do seu próprio client porque go-redis
		// entra em modo Pub/Sub exclusivo na conexão.
		redisClient := newCampaignRedisClient()
		defer redisClient.Close()

		pubsub := redisClient.Subscribe(ctx, channel)
		defer func() {
			if err := pubsub.Close(); err != nil {
				log.Printf("[CampaignSSE] ⚠️  Erro ao fechar pubsub: %v", err)
			}
		}()

		// Confirma subscrição antes de entrar no loop
		if _, err := pubsub.Receive(ctx); err != nil {
			log.Printf("[CampaignSSE] ⚠️  Erro ao confirmar subscrição: %v", err)
			return
		}

		log.Printf("[CampaignSSE] 📡 Cliente conectado (campaign=%s)", campaignID)

		// Goroutine receptora: ReceiveMessage é bloqueante.
		// Fecha msgCh ao sair — sinaliza o loop principal para encerrar.
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

		// Evento de confirmação de conexão (comentário SSE)
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
					// Canal Redis fechado — encerra stream
					return
				}
				fmt.Fprintf(w, "data: %s\n\n", data)
				if err := w.Flush(); err != nil {
					// Cliente desconectou
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

// newCampaignRedisClient cria um client go-redis dedicado para o subscriber SSE.
// Cada conexão SSE precisa de uma conexão Redis separada porque o go-redis
// entra em modo Pub/Sub exclusivo, impedindo outros comandos na mesma conexão.
func newCampaignRedisClient() *redis.Client {
	addr := os.Getenv("REDIS_ADDR")
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
