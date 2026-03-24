package handlers

import (
	"github.com/digitalcombo/sherlock-scraper/backend/internal/services"
	"github.com/gofiber/fiber/v2"
)

type PipelineHandler struct {
	aiService *services.AIService
}

func NewPipelineHandler(aiService *services.AIService) *PipelineHandler {
	return &PipelineHandler{
		aiService: aiService,
	}
}

func (h *PipelineHandler) GenerateAIPipeline(c *fiber.Ctx) error {
	type Request struct {
		Niche string `json:"niche"`
	}

	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Niche == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Campo 'niche' é obrigatório"})
	}

	pipeline, err := h.aiService.GeneratePipelineStages(req.Niche)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Por enquanto, retorna apenas o JSON gerado
	return c.JSON(pipeline)
}
