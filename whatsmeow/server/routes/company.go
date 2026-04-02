package routes

import (
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/env"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/repositories/companies"
	"github.com/verbeux-ai/whatsmiau/server/controllers"
	"github.com/verbeux-ai/whatsmiau/server/middleware"
	"github.com/verbeux-ai/whatsmiau/services"
)

func Company(group *echo.Group) {
	sqlCompanyRepo, _ := companies.NewSQL()
	
	// Em modo desenvolvimento, usar apenas SQL (sem cache)
	var companyRepo interfaces.CompanyRepository = sqlCompanyRepo
	if !env.Env.DebugMode {
		companyRepo = companies.NewRedis(sqlCompanyRepo, services.Redis())
	}

	companyController := controllers.NewCompany(companyRepo)

	// Apply JWT and super admin middleware
	protected := group.Group("", middleware.JWTAuth, middleware.SuperAdminOnly)

	protected.GET("", companyController.List)
	protected.POST("", companyController.Create)
	protected.GET("/:id", companyController.GetByID)
	protected.PUT("/:id", companyController.Update)
	protected.DELETE("/:id", companyController.Delete)
}

