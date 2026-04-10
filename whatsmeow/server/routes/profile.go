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

func Profile(group *echo.Group) {
	sqlUserRepo, _ := users.NewSQL()
	
	// Em modo desenvolvimento, usar apenas SQL (sem cache)
	var userRepo interfaces.UserRepository = sqlUserRepo
	if !env.Env.DebugMode {
		userRepo = users.NewRedis(sqlUserRepo, services.Redis())
	}

	userController := controllers.NewUser(userRepo)

	// Profile route - any authenticated user can update their own profile
	profileGroup := group.Group("", middleware.JWTAuth)
	profileGroup.PUT("/me", userController.UpdateProfile)
}

