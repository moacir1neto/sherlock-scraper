package database

import (
	"log"
	"os"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Connect() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=postgres dbname=crm port=5432 sslmode=disable TimeZone=America/Sao_Paulo"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database: \n", err)
	}

	log.Println("Database connection successfully opened")

	// Automigrate all domain models (includes Lead fields: estimated_value, due_date, tags, linked_lead_id)
	err = db.AutoMigrate(&domain.User{}, &domain.ScrapingJob{}, &domain.Lead{}, &domain.CompanySetting{}, &domain.Pipeline{}, &domain.PipelineStage{}, &domain.ProcessedMessage{})
	if err != nil {
		log.Fatal("Failed to migrate database: \n", err)
	}

	seedDefaultUser(db)
	seedDefaultSettings(db)

	DB = db
}

func seedDefaultSettings(db *gorm.DB) {
	var count int64
	db.Model(&domain.CompanySetting{}).Count(&count)
	if count == 0 {
		log.Println("No company settings found, seeding defaults...")
		settings := &domain.CompanySetting{
			ID:          1,
			CompanyName: "Sherlock Scraper",
			Niche:       "Software House",
			MainOffer:   "Desenvolvimento de sistemas web e mobile sob medida, com foco em automação de processos e integrações inteligentes.",
			ToneOfVoice: "Consultivo e Direto",
		}
		if err := db.Create(settings).Error; err != nil {
			log.Println("Error creating default company settings:", err)
		} else {
			log.Println("Default company settings created successfully")
		}
	}
}

func seedDefaultUser(db *gorm.DB) {
	var count int64
	db.Model(&domain.User{}).Count(&count)
	if count == 0 {
		log.Println("Database empty, seeding default admin user...")
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		if err != nil {
			log.Println("Error hashing password during seeding:", err)
			return
		}

		admin := &domain.User{
			Name:         "Admin User",
			Email:        "admin@admin.com",
			PasswordHash: string(hashedPassword),
		}

		if err := db.Create(admin).Error; err != nil {
			log.Println("Error creating default admin user:", err)
		} else {
			log.Println("Default admin user created successfully (User: admin / Pass: admin123)")
		}
	}
}
