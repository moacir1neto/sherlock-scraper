package routes

import (
	"github.com/labstack/echo/v4"
	aiSettingsRepo "github.com/verbeux-ai/whatsmiau/repositories/ai_settings"
	"github.com/verbeux-ai/whatsmiau/server/controllers"
	"github.com/verbeux-ai/whatsmiau/server/middleware"
	"go.uber.org/zap"
)

func AISettings(group *echo.Group) {
	repo, err := aiSettingsRepo.NewSQL()
	if err != nil {
		zap.L().Warn("ai_settings repo init failed, routes not registered", zap.Error(err))
		return
	}

	ctrl := controllers.NewAISettings(repo)
	protected := group.Group("", middleware.JWTAuth, middleware.AdminOnly)

	// GET /v1/admin/ai-settings  — carrega configurações da empresa
	// PUT /v1/admin/ai-settings  — salva configurações da empresa
	protected.GET("", ctrl.Get)
	protected.PUT("", ctrl.Save)
}
