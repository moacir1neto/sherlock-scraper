package routes

import (
	"context"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/env"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/repositories/companies"
	"github.com/verbeux-ai/whatsmiau/repositories/incidents"
	"github.com/verbeux-ai/whatsmiau/repositories/instances"
	"github.com/verbeux-ai/whatsmiau/repositories/users"
	"github.com/verbeux-ai/whatsmiau/server/controllers"
	"github.com/verbeux-ai/whatsmiau/server/middleware"
	"github.com/verbeux-ai/whatsmiau/services"
	"go.uber.org/zap"
)

func SuperAdmin(group *echo.Group) {
	sqlCompanyRepo, _ := companies.NewSQL()
	sqlUserRepo, _ := users.NewSQL()

	// Em modo desenvolvimento, usar apenas SQL (sem cache)
	var companyRepo interfaces.CompanyRepository = sqlCompanyRepo
	var userRepo interfaces.UserRepository = sqlUserRepo
	if !env.Env.DebugMode {
		companyRepo = companies.NewRedis(sqlCompanyRepo, services.Redis())
		userRepo = users.NewRedis(sqlUserRepo, services.Redis())
	}

	redisInstanceRepo := instances.NewRedis(services.Redis())

	superAdminController := controllers.NewSuperAdmin(companyRepo, userRepo, redisInstanceRepo)

	// Apply JWT and super admin middleware
	protected := group.Group("", middleware.JWTAuth, middleware.SuperAdminOnly)

	protected.GET("/instances", superAdminController.ListInstances)
	protected.DELETE("/instances/:id", superAdminController.DeleteInstance)

	// Monitoramento > Incidentes
	incidentRepo, errInc := incidents.NewSQL()
	if errInc == nil {
		incidentCtrl := controllers.NewIncident(incidentRepo)
		protected.GET("/incidents", incidentCtrl.List)
		protected.GET("/incidents/:id", incidentCtrl.GetByID)
		// Registrar callback para evitar import cycle (services -> repos/incidents -> services)
		services.RegisterIncidentRecorder(func(ctx context.Context, inc *models.Incident) {
			if err := incidentRepo.Create(ctx, inc); err != nil {
				zap.L().Warn("failed to record incident", zap.Error(err))
			}
		})
	}
}

