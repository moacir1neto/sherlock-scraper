package controllers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/services"
	"github.com/verbeux-ai/whatsmiau/utils"
)

// SystemLogsSSEController expõe o endpoint SSE de logs em tempo real.
// Acesso restrito a super_admin — JWT validado via query param ?token=.
type SystemLogsSSEController struct {
	hub *services.SystemLogHub
}

func NewSystemLogsSSEController(hub *services.SystemLogHub) *SystemLogsSSEController {
	return &SystemLogsSSEController{hub: hub}
}

// Stream — GET /v1/events/system-logs?token=JWT
func (h *SystemLogsSSEController) Stream(c echo.Context) error {
	tokenStr := c.QueryParam("token")
	if tokenStr == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "token query param obrigatório")
	}
	claims, err := utils.ValidateToken(tokenStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "token inválido")
	}
	if claims.Role != "super_admin" {
		return echo.NewHTTPError(http.StatusForbidden, "acesso restrito a super_admin")
	}

	c.Response().Header().Set("Content-Type", "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")
	c.Response().Header().Set("X-Accel-Buffering", "no")

	clientChan := h.hub.Subscribe()
	defer h.hub.Unsubscribe(clientChan)

	fmt.Fprintf(c.Response(), ": connected\n\n")
	c.Response().Flush()

	heartbeat := time.NewTicker(30 * time.Second)
	defer heartbeat.Stop()

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
