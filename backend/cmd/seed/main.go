package main

import (
	"log"
	"os"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/database"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	log.Println("Initializing database connection for seeding...")
	database.Connect()

	adminEmail := os.Getenv("ADMIN_EMAIL")
	adminPass := os.Getenv("ADMIN_PASSWORD")

	if adminEmail == "" {
		adminEmail = "admin@admin.com"
	}
	if adminPass == "" {
		adminPass = "admin123"
	}

	// Check if admin already exists
	var existing domain.User
	err := database.DB.Where("email = ?", adminEmail).First(&existing).Error
	if err == nil {
		log.Println("Admin user already exists. Seed skipped.")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPass), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal("Failed to hash password: ", err)
	}

	adminUser := &domain.User{
		Name:         "Sherlock Premium Admin",
		Email:        adminEmail,
		PasswordHash: string(hashedPassword),
	}

	err = database.DB.Create(adminUser).Error
	if err != nil {
		log.Fatal("Failed to seed admin user: ", err)
	}

	log.Printf("Successfully created Admin User! Email: %s | Password: %s\n", adminEmail, adminPass)
}
