package handlers

import (
	"fmt"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/repositories"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type PipelineHandler struct {
	aiService    *services.AIService
	pipelineRepo *repositories.PipelineRepository
}

func NewPipelineHandler(aiService *services.AIService, pipelineRepo *repositories.PipelineRepository) *PipelineHandler {
	return &PipelineHandler{
		aiService:    aiService,
		pipelineRepo: pipelineRepo,
	}
}

func getUserIDFromToken(c *fiber.Ctx) string {
	userToken, ok := c.Locals("user").(*jwt.Token)
	if !ok {
		return ""
	}
	claims, ok := userToken.Claims.(jwt.MapClaims)
	if !ok {
		return ""
	}
	// Normal claim locations for user ID
	if id, ok := claims["user_id"]; ok {
		return fmt.Sprintf("%v", id)
	}
	if id, ok := claims["sub"]; ok {
		return fmt.Sprintf("%v", id)
	}
	return ""
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

	userID := getUserIDFromToken(c)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User ID not found in token"})
	}

	// 1. Gera do Gemini
	aiPipeline, err := h.aiService.GeneratePipelineStages(req.Niche)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// 2. Converte para o Domínio
	pipeline := &domain.Pipeline{
		UserID: userID,
		Name:   aiPipeline.PipelineName,
	}
	for _, stage := range aiPipeline.Stages {
		pipeline.Stages = append(pipeline.Stages, domain.PipelineStage{
			Name:  stage.Name,
			Order: stage.Order,
			Color: stage.Color,
		})
	}

	// 3. Salva no banco de dados via Transaction
	if err := h.pipelineRepo.SavePipeline(pipeline); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Falha ao salvar pipeline no banco", "details": err.Error()})
	}

	return c.JSON(pipeline)
}

func (h *PipelineHandler) GetPipeline(c *fiber.Ctx) error {
	userID := getUserIDFromToken(c)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User ID not found in token"})
	}

	pipeline, err := h.pipelineRepo.GetPipelineByUserID(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	if pipeline == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Pipeline not found"})
	}

	return c.JSON(pipeline)
}
