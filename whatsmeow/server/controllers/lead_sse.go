package controllers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

// KanbanMovedChannel é o canal Redis Pub/Sub no qual o Sherlock publica
// eventos de movimentação de Kanban. Deve ser o mesmo valor definido em
// backend/internal/sse/redis_broadcaster.go do módulo Sherlock.
const KanbanMovedChannel = "sherlock:leads:kanban_moved"

// LeadSSE expõe um endpoint SSE que retransmite eventos do canal Redis
// para os clientes do painel WhatsMeow.
//
// Autenticação: feita INTERNAMENTE via ?token= query param porque o
// EventSource da Web API não suporta headers customizados (Authorization).
// Não depende de nenhum middleware de grupo para autenticar.
type LeadSSE struct {
	redis *redis.Client
}

// NewLeadSSE cria o controller injetando o client Redis existente.
func NewLeadSSE(redis *redis.Client) *LeadSSE {
	return &LeadSSE{redis: redis}
}

// Stream é o handler Echo para GET /admin/leads/events?token=JWT
//
// Fluxo:
//  1. Valida JWT do query param ?token= (não aceita Bearer header aqui).
//  2. Verifica que o role é admin ou super_admin.
//  3. Configura headers SSE + CORS explícito.
//  4. Assina o canal Redis KanbanMovedChannel.
//  5. Goroutine interna usa ReceiveMessage (sem conflito com Channel interno).
//  6. Loop principal: seleciona entre eventos, heartbeat (30s) e ctx.Done().
//  7. Ao desconectar, ctx é cancelado → pubsub é fechado → goroutine encerra.
func (h *LeadSSE) Stream(c echo.Context) error {
	// --- Passo 1 & 2: validação interna do JWT ---
	tokenStr := c.QueryParam("token")
	if tokenStr == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "token query parameter is required")
	}

	claims, err := utils.ValidateToken(tokenStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired token")
	}

	if claims.Role != "admin" && claims.Role != "super_admin" {
		return echo.NewHTTPError(http.StatusForbidden, "admin access required")
	}

	// --- Passo 3: headers SSE + CORS explícito ---
	// CORS explícito no handler garante que o header esteja presente mesmo
	// quando proxies ou CDN retiram headers definidos por middlewares.
	if origin := c.Request().Header.Get("Origin"); origin != "" {
		c.Response().Header().Set("Access-Control-Allow-Origin", origin)
		c.Response().Header().Set("Access-Control-Allow-Credentials", "true")
	}

	c.Response().Header().Set("Content-Type", "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")
	c.Response().Header().Set("X-Accel-Buffering", "no")
	c.Response().WriteHeader(http.StatusOK)

	ctx := c.Request().Context()

	// --- Passo 4: subscrição Redis ---
	pubsub := h.redis.Subscribe(ctx, KanbanMovedChannel)
	defer func() {
		if err := pubsub.Close(); err != nil && ctx.Err() == nil {
			zap.L().Warn("[LeadSSE] erro ao fechar pubsub", zap.Error(err))
		}
	}()

	// Aguarda confirmação de subscrição antes de entrar no loop de mensagens.
	if _, err := pubsub.Receive(ctx); err != nil {
		// Contexto cancelado ou erro de rede — saída limpa sem log de erro.
		return nil
	}

	zap.L().Info("[LeadSSE] cliente conectado",
		zap.String("user_id", claims.UserID),
		zap.String("role", claims.Role),
	)

	// --- Passo 5: goroutine receptora ---
	// Canal intermediário: desacopla ReceiveMessage bloqueante do select principal.
	// A goroutine encerra automaticamente quando pubsub.Close() é chamado (defer acima).
	msgCh := make(chan string, 8)
	go func() {
		for {
			msg, err := pubsub.ReceiveMessage(ctx)
			if err != nil {
				close(msgCh)
				return
			}
			select {
			case msgCh <- msg.Payload:
			default:
				// Buffer cheio — descarta para este cliente sem bloquear o broadcast.
			}
		}
	}()

	// Evento inicial de confirmação (comentário SSE — não dispara onmessage).
	fmt.Fprintf(c.Response().Writer, ": connected\n\n")
	c.Response().Flush()

	heartbeat := time.NewTicker(30 * time.Second)
	defer heartbeat.Stop()

	// --- Passo 6: loop principal ---
	for {
		select {
		case <-ctx.Done():
			zap.L().Info("[LeadSSE] cliente desconectado", zap.String("user_id", claims.UserID))
			return nil

		case payload, ok := <-msgCh:
			if !ok {
				return nil
			}
			fmt.Fprintf(c.Response().Writer, "data: %s\n\n", payload)
			c.Response().Flush()

		case <-heartbeat.C:
			fmt.Fprintf(c.Response().Writer, ": heartbeat\n\n")
			c.Response().Flush()
		}
	}
}
