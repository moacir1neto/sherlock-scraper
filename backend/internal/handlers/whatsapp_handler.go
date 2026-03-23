package handlers

import (
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
	"github.com/gofiber/fiber/v2"
)

type WhatsAppHandler struct {
	service ports.WhatsAppService
}

func NewWhatsAppHandler(service ports.WhatsAppService) *WhatsAppHandler {
	return &WhatsAppHandler{service: service}
}

func (h *WhatsAppHandler) SendMessage(c *fiber.Ctx) error {
	type Request struct {
		InstanceID string `json:"instance_id"`
		Number     string `json:"number"`
		Text       string `json:"text"`
	}

	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Cannot parse JSON",
		})
	}

	if req.InstanceID == "" || req.Number == "" || req.Text == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Missing required fields",
		})
	}

	err := h.service.SendTextMessage(c.Context(), req.InstanceID, req.Number, req.Text)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Message sent successfully",
	})
}

func (h *WhatsAppHandler) ListInstances(c *fiber.Ctx) error {
	instances, err := h.service.GetInstances(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(instances)
}
