package routes

import (
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/server/controllers"
	"github.com/verbeux-ai/whatsmiau/services"
)

// HandoffSSE registra o endpoint SSE de alertas de handoff do Super Vendedor.
// A rota é pública (sem middleware de auth) pois o JWT é validado internamente
// via query param — necessário porque EventSource não suporta headers customizados.
func HandoffSSE(group *echo.Group, hub *services.HandoffHub) {
	ctrl := controllers.NewHandoffSSEController(hub)
	group.GET("/events/handoff", ctrl.Stream)
}
