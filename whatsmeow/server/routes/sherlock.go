package routes

import (
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/repositories/leads"
	"github.com/verbeux-ai/whatsmiau/repositories/scrapes"
	"github.com/verbeux-ai/whatsmiau/server/controllers"
	"github.com/verbeux-ai/whatsmiau/server/middleware"
	"github.com/verbeux-ai/whatsmiau/services"
	"go.uber.org/zap"
)

func Sherlock(group *echo.Group) {
	scrapeRepo, err := scrapes.NewSQL()
	if err != nil {
		zap.L().Warn("scrapes repo init failed, sherlock routes not registered", zap.Error(err))
		return
	}

	leadRepo, err := leads.NewSQL()
	if err != nil {
		zap.L().Warn("leads repo init failed, sherlock routes not registered", zap.Error(err))
		return
	}

	sherlockService := services.NewSherlockService()
	ctrl := controllers.NewSherlock(sherlockService, scrapeRepo, leadRepo)

	protected := group.Group("", middleware.JWTAuth, middleware.AdminOnly)

	// POST /v1/admin/sherlock/extract — inicia campanha de raspagem (async)
	protected.POST("/extract", ctrl.Extract)

	// GET  /v1/admin/sherlock/scrapes       — lista campanhas da empresa
	// GET  /v1/admin/sherlock/scrapes/:id   — status de uma campanha
	// DELETE /v1/admin/sherlock/scrapes/:id — remove campanha e seus leads
	protected.GET("/scrapes", ctrl.ListScrapes)
	protected.GET("/scrapes/:id", ctrl.GetScrape)
	protected.DELETE("/scrapes/:id", ctrl.DeleteScrape)
}
