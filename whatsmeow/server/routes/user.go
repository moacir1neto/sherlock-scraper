package routes

import (
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/env"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/repositories/users"
	"github.com/verbeux-ai/whatsmiau/server/controllers"
	"github.com/verbeux-ai/whatsmiau/server/middleware"
	"github.com/verbeux-ai/whatsmiau/services"
)

func User(group *echo.Group) {
	sqlUserRepo, _ := users.NewSQL()

	// Em modo desenvolvimento, usar apenas SQL (sem cache)
	var userRepo interfaces.UserRepository = sqlUserRepo
	if !env.Env.DebugMode {
		userRepo = users.NewRedis(sqlUserRepo, services.Redis())
	}

	userController := controllers.NewUser(userRepo)

	// Apply JWT and super admin middleware
	protected := group.Group("", middleware.JWTAuth, middleware.SuperAdminOnly)

	protected.GET("", userController.List)
	protected.POST("", userController.Create)
	protected.GET("/:id", userController.GetByID)
	protected.PUT("/:id", userController.Update)
	protected.DELETE("/:id", userController.Delete)
}
