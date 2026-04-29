package handlers

import (
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/database"
	"github.com/gofiber/fiber/v2"
)

type SettingHandler struct{}

func NewSettingHandler() *SettingHandler {
	return &SettingHandler{}
}

// GetSettings retorna as configurações globais da empresa (ID 1).
// GET /api/v1/protected/settings
func (h *SettingHandler) GetSettings(c *fiber.Ctx) error {
	var settings domain.CompanySetting
	if err := database.DB.First(&settings, 1).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "company settings not found",
		})
	}

	return c.JSON(fiber.Map{"settings": settings})
}

// UpdateSettings atualiza as configurações globais da empresa (ID 1).
// PUT /api/v1/protected/settings
func (h *SettingHandler) UpdateSettings(c *fiber.Ctx) error {
	var input domain.CompanySetting
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	var settings domain.CompanySetting
	if err := database.DB.First(&settings, 1).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "company settings not found",
		})
	}

	settings.CompanyName = input.CompanyName
	settings.Niche = input.Niche
	settings.MainOffer = input.MainOffer
	settings.ToneOfVoice = input.ToneOfVoice

	if err := database.DB.Save(&settings).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to update settings",
		})
	}

	return c.JSON(fiber.Map{
		"message":  "settings updated successfully",
		"settings": settings,
	})
}
