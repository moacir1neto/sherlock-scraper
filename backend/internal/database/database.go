package database

import (
	"log"
	"os"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
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

	// Automigrate User, Lead and ScrapingJob
	err = db.AutoMigrate(&domain.User{}, &domain.ScrapingJob{}, &domain.Lead{})
	if err != nil {
		log.Fatal("Failed to migrate database: \n", err)
	}

	DB = db
}
