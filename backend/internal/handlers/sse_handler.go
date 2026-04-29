package handlers

import (
	"bufio"
	"fmt"
	"os"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/sse"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"
)

// SSEHandler expõe um endpoint de Server-Sent Events para notificações
// em tempo real do Kanban.
//
// Por que SSE e não WebSocket?
//   - A comunicação é unidirecional: servidor → cliente (perfeito para notificações).
//   - SSE funciona sobre HTTP/1.1 simples, sem upgrade de protocolo.
//   - EventSource da Web API tem reconexão automática nativa.
//   - Mais simples de implementar e depurar que WebSocket para este caso.
//
// Autenticação:
//   - O EventSource da Web API não permite headers customizados.
//   - Passamos o JWT como query param `?token=...`, validado aqui.
//   - O mesmo padrão é usado pelo WebSocket do WhatsMeow (/v1/ws/chat?token=...).
type SSEHandler struct {
	hub *sse.Hub
}

// NewSSEHandler cria o handler injetando o hub SSE.
func NewSSEHandler(hub *sse.Hub) *SSEHandler {
	return &SSEHandler{hub: hub}
}

// Stream é o handler Fiber para GET /api/v1/events/kanban?token=JWT
//
// Fluxo:
//  1. Valida o JWT do query param.
//  2. Registra o cliente no hub (recebe canal dedicado).
//  3. Inicia o loop de streaming via fasthttp.StreamWriter.
//  4. Heartbeat a cada 30s para manter a conexão viva através de proxies.
//  5. Ao desconectar (cliente fecha aba / rede cai), faz Unsubscribe.
func (h *SSEHandler) Stream(c *fiber.Ctx) error {
	// --- Passo 1: validação do JWT via query param ---
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

	// --- Passo 2: headers SSE ---
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no") // Desabilita buffering em proxies Nginx

	// --- Passo 3 & 4 & 5: streaming via fasthttp.StreamWriter ---
	// Registra o cliente antes de entrar no StreamWriter para evitar
	// race condition com eventos que possam chegar imediatamente.
	clientChan := h.hub.Subscribe()

	c.Context().SetBodyStreamWriter(fasthttp.StreamWriter(func(w *bufio.Writer) {
		// Garante que o canal seja removido do hub quando o cliente desconectar
		defer h.hub.Unsubscribe(clientChan)

		// Evento inicial de confirmação de conexão (comentário SSE — ignorado pelo EventSource)
		fmt.Fprintf(w, ": connected\n\n")
		if err := w.Flush(); err != nil {
			return
		}

		// Ticker para heartbeat — mantém a conexão viva em proxies com timeout de idle
		heartbeat := time.NewTicker(30 * time.Second)
		defer heartbeat.Stop()

		for {
			select {
			case data, ok := <-clientChan:
				if !ok {
					// Canal fechado pelo hub (não deveria acontecer normalmente)
					return
				}
				// Formato SSE: "data: <payload>\n\n"
				fmt.Fprintf(w, "data: %s\n\n", data)
				if err := w.Flush(); err != nil {
					// Cliente desconectou — saímos do loop
					return
				}

			case <-heartbeat.C:
				// Comentário SSE (linha começando com ":") — mantém conexão sem disparar onmessage
				fmt.Fprintf(w, ": heartbeat\n\n")
				if err := w.Flush(); err != nil {
					return
				}
			}
		}
	}))

	return nil
}
