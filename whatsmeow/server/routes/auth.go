package routes

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/repositories/audit_logs"
	"github.com/verbeux-ai/whatsmiau/repositories/users"
	"github.com/verbeux-ai/whatsmiau/server/controllers"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

func Auth(group *echo.Group) {
	sqlUserRepo, err := users.NewSQL()
	if err != nil {
		zap.L().Error("auth: user repository unavailable, login will return 503", zap.Error(err))
		group.POST("/login", func(c echo.Context) error {
			return utils.HTTPFail(c, http.StatusServiceUnavailable, err, "Authentication service unavailable. Database connection failed.")
		})
		return
	}
	var auditRepo interfaces.AuditLogRepository
	if ar, errAudit := audit_logs.NewSQL(); errAudit == nil {
		auditRepo = ar
	}
	authController := controllers.NewAuth(sqlUserRepo, auditRepo)
	group.POST("/login", authController.Login)
}

