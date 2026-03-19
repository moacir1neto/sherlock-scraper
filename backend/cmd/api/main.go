package main

import (
	"log"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/database"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/handlers"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/middlewares"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/repositories"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func main() {
	// 1. Initialize Database connection & Auto-migrations
	database.Connect()

	// 2. Initialize Fiber App
	app := fiber.New()
	app.Use(logger.New())

	app.Use(cors.New(cors.Config{
		AllowOrigins: "http://localhost:5173", // Libera o acesso para o seu Front-end
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, HEAD, PUT, DELETE, PATCH, OPTIONS",
	}))

	// 3. Dependency Injection (Injecting repos into services, and services into handlers)
	userRepo := repositories.NewUserRepository(database.DB)
	authService := services.NewAuthService(userRepo)
	authHandler := handlers.NewAuthHandler(authService)

	leadRepo := repositories.NewLeadRepository(database.DB)
	leadService := services.NewLeadService(leadRepo)
	leadHandler := handlers.NewLeadHandler(leadService)

	scrapeHandler := handlers.NewScrapeHandler(leadService)

	// 4. API Routes
	api := app.Group("/api/v1")

	// 4.1. Public Routes
	auth := api.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)

	// 4.2. Protected Routes
	protected := api.Group("/protected", middlewares.Protected())
	protected.Get("/me", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "Welcome to the protected area! Your JWT is valid.",
			"user_id": c.Locals("user"), // jwtware injects user info into locals if needed
		})
	})
	
	// Lead Routes
	leads := protected.Group("/leads")
	leads.Get("", leadHandler.GetLeads)
	leads.Post("/upload", leadHandler.UploadCSV)
	leads.Patch("/:id/status", leadHandler.UpdateStatus)

	// Scrape Routes
	protected.Post("/scrape", scrapeHandler.Start)
	protected.Get("/scrapes", scrapeHandler.ListScrapes)
	protected.Get("/scrapes/status", scrapeHandler.Status)
	protected.Get("/scrapes/:id/leads", scrapeHandler.GetLeadsByJob)

	log.Println("Server is running on port 3000...")
	log.Fatal(app.Listen(":3000"))
}
