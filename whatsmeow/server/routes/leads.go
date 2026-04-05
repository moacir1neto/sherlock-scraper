package routes

import (
	"github.com/labstack/echo/v4"
	aiSettingsRepo "github.com/verbeux-ai/whatsmiau/repositories/ai_settings"
	"github.com/verbeux-ai/whatsmiau/repositories/leads"
	"github.com/verbeux-ai/whatsmiau/server/controllers"
	"github.com/verbeux-ai/whatsmiau/server/middleware"
	"github.com/verbeux-ai/whatsmiau/services"
	"go.uber.org/zap"
)

func Leads(group *echo.Group) {
	leadRepo, err := leads.NewSQL()
	if err != nil {
		zap.L().Warn("leads repo init failed, /admin/leads routes not registered", zap.Error(err))
		return
	}

	aiRepo, err := aiSettingsRepo.NewSQL()
	if err != nil {
		// Não bloqueia o start — Analyze vai funcionar sem contexto de vendedor
		zap.L().Warn("ai_settings repo init failed, vendor context will be empty", zap.Error(err))
	}

	geminiService := services.NewGeminiService()
	ctrl := controllers.NewLead(leadRepo, geminiService, aiRepo)
	protected := group.Group("", middleware.JWTAuth, middleware.AdminOnly)

	protected.GET("/leads", ctrl.List)
	protected.POST("/leads", ctrl.Create)
	protected.POST("/leads/bulk", ctrl.BulkCreate)
	protected.GET("/leads/:id", ctrl.GetByID)
	protected.PUT("/leads/:id", ctrl.Update)
	protected.PATCH("/leads/:id/status", ctrl.UpdateStatus)
	protected.DELETE("/leads/:id", ctrl.Delete)
	// Leads de uma campanha específica
	protected.GET("/leads/scrape/:scrape_id", ctrl.ListByScrape)
	// Dossiê IA: POST /admin/leads/:id/analyze?skill=raiox|email|call
	protected.POST("/leads/:id/analyze", ctrl.Analyze)
	// Dossiê IA em lote: POST /admin/leads/analyze/bulk
	protected.POST("/leads/analyze/bulk", ctrl.AnalyzeBulk)

	// SSE — notificações em tempo real de movimentações do Kanban.
	// Sem middleware de grupo: a autenticação é feita INTERNAMENTE no handler
	// via ?token= query param (EventSource não suporta headers customizados).
	sseCtrl := controllers.NewLeadSSE(services.Redis())
	group.GET("/leads/events", sseCtrl.Stream)
}
