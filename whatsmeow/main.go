package main

import (
	"log"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/verbeux-ai/whatsmiau/env"
	log_connect "github.com/verbeux-ai/whatsmiau/lib/log-connect"
	"github.com/verbeux-ai/whatsmiau/lib/whatsmiau"
	"github.com/verbeux-ai/whatsmiau/repositories/chats"
	"github.com/verbeux-ai/whatsmiau/repositories/instances"
	"github.com/verbeux-ai/whatsmiau/repositories/messages"
	"github.com/verbeux-ai/whatsmiau/repositories/scheduled_messages"
	"github.com/verbeux-ai/whatsmiau/server/routes"
	"github.com/verbeux-ai/whatsmiau/services"
	"go.uber.org/zap"
	"golang.org/x/net/context"
	"golang.org/x/net/http2"
)

func main() {
	if err := env.Load(); err != nil {
		panic(err)
	}

	if err := log_connect.StartLogger(); err != nil {
		log.Fatalln(err)
	}

	ctx, c := context.WithTimeout(context.Background(), 10*time.Second)
	defer c()

	// Run database migrations
	if err := services.RunMigrations(); err != nil {
		zap.L().Fatal("failed to run migrations", zap.Error(err))
	}

	whatsmiau.LoadMiau(ctx, services.SQLStore(), instances.NewRedis(services.Redis()))

	app := echo.New()
	app.Pre(middleware.Recover())
	app.Pre(middleware.RemoveTrailingSlash())
	// CORS: AllowOrigins com wildcard para desenvolvimento.
	// AllowCredentials: false permite usar "*" como origin.
	// Para SSE com ?token= não há necessidade de credentials (cookies).
	app.Pre(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Accept", "Content-Type", "Authorization", "apikey"},
		AllowCredentials: false,
	}))

	hub := routes.Load(app)

	// Start chat persistence workers (enqueue from event handler, persist in background, broadcast via WS)
	// O RedisLeadEventPublisher publica no canal Redis quando uma mensagem é recebida,
	// permitindo que o Sherlock CRM mova o lead automaticamente no Kanban.
	if chatRepo, err := chats.NewSQL(); err == nil {
		if messageRepo, err := messages.NewSQL(); err == nil {
			ch := services.NewChatJobChan()
			whatsmiau.Get().SetChatJobChan(ch)
			leadPublisher := services.NewRedisLeadEventPublisher(services.Redis())
			services.RunChatWorkers(ch, chatRepo, messageRepo, hub, leadPublisher)
		}
	}

	// Start scheduled message worker (sends pending scheduled messages every minute)
	if schedRepo, err := scheduled_messages.NewSQL(); err == nil {
		services.RunScheduledWorker(schedRepo)
	}

	port := ":" + env.Env.Port
	zap.L().Info("starting server...", zap.String("port", port))

	s := &http2.Server{}
	if err := app.StartH2CServer(port, s); err != nil {
		zap.L().Fatal("failed to start server", zap.Error(err))
	}
}
