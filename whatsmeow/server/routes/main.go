package routes

import (
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/repositories/instances"
	"github.com/verbeux-ai/whatsmiau/server/controllers"
	"github.com/verbeux-ai/whatsmiau/server/middleware"
	"github.com/verbeux-ai/whatsmiau/server/ws"
	"github.com/verbeux-ai/whatsmiau/services"
)

func Load(app *echo.Echo) *ws.Hub {
	app.Pre(middleware.Simplify(middleware.AuthOrJWT))

	v1 := app.Group("/v1")
	V1(v1)

	hub := ws.NewHub()
	chatHandler := ws.NewChatHandler(hub, instances.NewRedis(services.Redis()))
	RegisterChatWS(v1, chatHandler)

	return hub
}

// RegisterChatWS registers the WebSocket endpoint for chat. Auth is via global AuthOrJWT (Bearer or token query param).
func RegisterChatWS(v1Group *echo.Group, chatHandler *ws.ChatHandler) {
	g := v1Group.Group("/ws")
	g.GET("/chat", chatHandler.ServeWS)
}

func V1(group *echo.Group) {
	group.GET("/uploads/:filename", controllers.ServeUpload)
	Root(group)
	Instance(group.Group("/instance"))
	// Rotas de mensagem também em /instance/:instance/message para compatibilidade (ex.: Evolution)
	Message(group.Group("/instance/:instance/message"))
	Chat(group.Group("/instance/:instance/chat"))

	ChatEVO(group.Group("/chat"))
	MessageEVO(group.Group("/message"))

	// Auth routes (no auth middleware)
	Auth(group.Group("/auth"))

	// Super admin routes (protected)
	SuperAdmin(group.Group("/super-admin"))
	Company(group.Group("/super-admin/companies"))
	User(group.Group("/super-admin/users"))

	// Admin routes (for admin users to manage their company)
	Admin(group.Group("/admin"))
	Sherlock(group.Group("/admin/sherlock"))
	AISettings(group.Group("/admin/ai-settings"))

	// User profile routes (any authenticated user)
	Profile(group.Group("/users"))
}
