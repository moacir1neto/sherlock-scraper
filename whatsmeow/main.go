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
	"github.com/verbeux-ai/whatsmiau/repositories/leads"
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

	// Super Vendedor: HandoffHub para alertas SSE em tempo real
	handoffHub := services.NewHandoffHub()
	hub := routes.Load(app, handoffHub)

	// Start chat persistence workers (enqueue from event handler, persist in background, broadcast via WS)
	// O KanbanAutomation move o lead automaticamente no CRM quando recebe ou envia mensagens.
	if chatRepo, err := chats.NewSQL(); err == nil {
		if messageRepo, err := messages.NewSQL(); err == nil {
			ch := services.NewChatJobChan()
			whatsmiau.Get().SetChatJobChan(ch)

			leadRepo, _ := leads.NewSQL()
			instancesRepo := instances.NewRedis(services.Redis())
			kanbanSvc := services.NewKanbanAutomation(leadRepo, instancesRepo, hub)

			// Super Vendedor: inicializar o agente de vendas autônomo
			var salesAgent *services.SalesAgentService
			if db, err := services.DB(); err == nil {
				salesAgent = services.NewSalesAgentService(db, instancesRepo, whatsmiau.Get(), handoffHub)
				zap.L().Info("Super Vendedor inicializado")
			} else {
				zap.L().Warn("Super Vendedor desativado: falha ao abrir DB", zap.Error(err))
			}

			// LeadEventPublisher: publica mensagens recebidas no Redis Pub/Sub
			// para o Sherlock CRM consumir via canal "whatsapp:messages:received".
			publisher := services.NewRedisLeadEventPublisher(services.Redis())
			zap.L().Info("LeadEventPublisher (Redis) inicializado")

			services.RunChatWorkers(ch, chatRepo, messageRepo, hub, kanbanSvc, salesAgent, publisher)
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
