package main

import (
	"context"
	"log"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/database"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/handlers"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/middlewares"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/queue"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/repositories"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/services"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/sse"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func main() {
	// 1. Initialize Database connection & Auto-migrations
	database.Connect()

	// 2. Initialize Redis Queue Client
	queue.InitClient()
	defer queue.CloseClient()

	// 3. Initialize Fiber App
	app := fiber.New(fiber.Config{
		StrictRouting: false,
	})
	app.Use(logger.New())

	app.Use(cors.New(cors.Config{
		AllowOrigins: "http://localhost:5173", // Libera o acesso para o seu Front-end
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Internal-Token",
		AllowMethods: "GET, POST, HEAD, PUT, DELETE, PATCH, OPTIONS",
	}))

	// 4. Dependency Injection (Injecting repos into services, and services into handlers)
	userRepo := repositories.NewUserRepository(database.DB)
	authService := services.NewAuthService(userRepo)
	authHandler := handlers.NewAuthHandler(authService)

	leadRepo := repositories.NewLeadRepository(database.DB)
	leadService := services.NewLeadService(leadRepo)
	leadHandler := handlers.NewLeadHandler(leadService)

	scrapeHandler := handlers.NewScrapeHandler(leadService)

	// AI Service (Google Gemini)
	aiService := services.NewAIService()
	aiHandler := handlers.NewAIHandler(aiService)

	// Pipeline (CRM/Kanban)
	pipelineRepo := repositories.NewPipelineRepository(database.DB)
	pipelineHandler := handlers.NewPipelineHandler(aiService, pipelineRepo)

	// CNPJ Enrichment Service
	cnpjService := services.NewCNPJService(leadService)
	cnpjHandler := handlers.NewCNPJHandler(cnpjService)

	// Company Settings
	settingHandler := handlers.NewSettingHandler()

	// SSE Hub — inicializado aqui para ser injetado tanto no handler quanto
	// no KanbanAutomationService (seção 6) sem quebrar a ordem de declaração.
	sseHub := sse.NewHub()
	sseHandler := handlers.NewSSEHandler(sseHub)

	// 5. API Routes
	api := app.Group("/api/v1")

	// 5.1. Public Routes
	auth := api.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)

	// SSE — Server-Sent Events para notificações em tempo real do Kanban.
	// A rota valida o JWT internamente via query param ?token=... porque o
	// EventSource da Web API não suporta headers customizados.
	api.Get("/events/kanban", sseHandler.Stream)

	// 5.2. Protected Routes
	protected := api.Group("/protected", middlewares.Protected())
	protected.Get("/me", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "Welcome to the protected area! Your JWT is valid.",
			"user_id": c.Locals("user"), // jwtware injects user info into locals if needed
		})
	})
	
	// Lead Routes
	leads := protected.Group("/leads")
	leads.Get("/", leadHandler.GetLeads)
	leads.Post("/", leadHandler.CreateLead)
	leads.Post("/upload", leadHandler.UploadCSV)
	leads.Patch("/:id/status", leadHandler.UpdateStatus)
	leads.Put("/:id", leadHandler.UpdateLead)
	leads.Delete("/:id", leadHandler.DeleteLead)

	// AI Analysis Routes
	leads.Post("/analyze/bulk", aiHandler.AnalyzeLeadsBulk) // Análise em massa
	leads.Post("/:id/analyze", aiHandler.AnalyzeLead)      // Gera análise de IA
	leads.Get("/:id/analysis", aiHandler.GetAnalysis)      // Retorna análise salva

	// CNPJ Enrichment Routes
	leads.Post("/:id/enrich-cnpj", cnpjHandler.EnrichCNPJ)       // Busca CNPJ por nome
	leads.Post("/:id/validate-cnpj", cnpjHandler.ValidateCNPJ)   // Valida CNPJ existente

	// Pipeline routes
	protected.Get("/pipeline", pipelineHandler.GetPipeline)
	protected.Get("/pipeline/all", pipelineHandler.GetAllPipelines)
	protected.Post("/pipeline", pipelineHandler.CreatePipeline)
	protected.Post("/pipeline/stage", pipelineHandler.AddStage)
	protected.Post("/pipeline/generate-ai", pipelineHandler.GenerateAIPipeline)
	protected.Delete("/pipeline", pipelineHandler.DeletePipeline)

	// Settings Routes
	protected.Get("/settings", settingHandler.GetSettings)
	protected.Put("/settings", settingHandler.UpdateSettings)

	// Scrape Routes
	protected.Post("/scrape", scrapeHandler.Start)
	protected.Get("/scrapes", scrapeHandler.ListScrapes)
	protected.Get("/scrapes/status", scrapeHandler.Status)
	protected.Get("/scrapes/:id/leads", scrapeHandler.GetLeadsByJob)
	protected.Delete("/scrapes/:id", scrapeHandler.DeleteJob)
	protected.Delete("/scrapings/:id", scrapeHandler.DeleteJob) // Alias as requested

	// 5.3. Internal Routes (server-to-server, no JWT)
	internal := api.Group("/internal", middlewares.InternalAuth())
	internal.Post("/scrape-sync", scrapeHandler.StartSync)
	internal.Post("/scrape-start", scrapeHandler.StartAsync)
	internal.Get("/scrape-status/:job_id", scrapeHandler.StatusWithLeads)

	// 6. Start Queue Worker in background
	log.Println("🚀 Starting Queue Worker in background...")
	go queue.StartServer()

	// 6.1 Kanban Automation — Redis Pub/Sub Subscriber
	// Escuta o canal "whatsapp:messages:received" e move leads automaticamente
	// para o estágio "contatado" quando uma mensagem WhatsApp é recebida.
	// O CompositeBroadcaster notifica:
	//   - sseHub       → clientes SSE do Sherlock CRM (in-memory)
	//   - redisBroadcaster → painel WhatsMeow via canal Redis "sherlock:leads:kanban_moved"
	redisBroadcaster := sse.NewRedisBroadcaster()
	composite := sse.NewCompositeBroadcaster(sseHub, redisBroadcaster)
	kanbanService := services.NewKanbanAutomationService(leadRepo, composite)
	redisSubscriber := handlers.NewRedisSubscriber(kanbanService)
	go redisSubscriber.Listen(context.Background())
	log.Println("📡 Kanban Automation subscriber iniciado (canal: whatsapp:messages:received)")

	// 7. Start HTTP Server
	log.Println("🌐 Server is running on port 3000...")
	log.Fatal(app.Listen(":3000"))
}
