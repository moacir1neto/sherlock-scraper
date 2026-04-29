package routes

import (
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/server/controllers"
	"github.com/verbeux-ai/whatsmiau/services"
)

// SystemLogsSSE registra o endpoint SSE de logs em tempo real.
// Auth via query param ?token= (EventSource não suporta headers customizados).
func SystemLogsSSE(group *echo.Group, hub *services.SystemLogHub) {
	ctrl := controllers.NewSystemLogsSSEController(hub)
	group.GET("/events/system-logs", ctrl.Stream)
}
