package controllers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/services"
	"github.com/verbeux-ai/whatsmiau/utils"
)

// HandoffSSEController expõe o endpoint SSE para alertas de handoff do Super Vendedor.
//
// Autenticação: JWT via query param `?token=` — EventSource da Web API não suporta
// headers customizados, então seguimos o mesmo padrão do Sherlock backend.
type HandoffSSEController struct {
	hub *services.HandoffHub
}

// NewHandoffSSEController cria o controller com o hub injetado.
func NewHandoffSSEController(hub *services.HandoffHub) *HandoffSSEController {
	return &HandoffSSEController{hub: hub}
}

// Stream é o handler Echo para GET /v1/events/handoff?token=JWT
//
// Fluxo:
//  1. Valida o JWT via query param.
//  2. Registra cliente no HandoffHub.
//  3. Entra no loop SSE com heartbeat a cada 30s.
//  4. Ao desconectar, faz Unsubscribe do hub.
func (h *HandoffSSEController) Stream(c echo.Context) error {
	// 1. Validar JWT via query param
	tokenStr := c.QueryParam("token")
	if tokenStr == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "token query param obrigatório")
	}
	if _, err := utils.ValidateToken(tokenStr); err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "token inválido")
	}

	// 2. Headers SSE
	c.Response().Header().Set("Content-Type", "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")
	c.Response().Header().Set("X-Accel-Buffering", "no")

	// 3. Registrar cliente
	clientChan := h.hub.Subscribe()
	defer h.hub.Unsubscribe(clientChan)

	// Confirmação de conexão (comentário SSE — não dispara onmessage)
	fmt.Fprintf(c.Response(), ": connected\n\n")
	c.Response().Flush()

	heartbeat := time.NewTicker(30 * time.Second)
	defer heartbeat.Stop()

	// 4. Loop de streaming
	notify := c.Request().Context().Done()
	for {
		select {
		case <-notify:
			return nil

		case data, ok := <-clientChan:
			if !ok {
				return nil
			}
			fmt.Fprintf(c.Response(), "data: %s\n\n", data)
			if err := flushSSE(c); err != nil {
				return nil
			}

		case <-heartbeat.C:
			fmt.Fprintf(c.Response(), ": heartbeat\n\n")
			if err := flushSSE(c); err != nil {
				return nil
			}
		}
	}
}

func flushSSE(c echo.Context) error {
	if f, ok := c.Response().Writer.(http.Flusher); ok {
		f.Flush()
	}
	return nil
}
