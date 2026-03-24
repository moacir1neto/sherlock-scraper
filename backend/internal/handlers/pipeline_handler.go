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
	localUser := c.Locals("user")
	if localUser == nil {
		fmt.Println("[Pipeline] c.Locals('user') is nil — JWT middleware may not have run")
		return ""
	}

	userToken, ok := localUser.(*jwt.Token)
	if !ok {
		fmt.Printf("[Pipeline] c.Locals('user') is not *jwt.Token, got: %T\n", localUser)
		return ""
	}

	claims, ok := userToken.Claims.(jwt.MapClaims)
	if !ok {
		fmt.Println("[Pipeline] Failed to cast token claims to MapClaims")
		return ""
	}

	// Normal claim locations for user ID
	if id, ok := claims["user_id"]; ok {
		userID := fmt.Sprintf("%v", id)
		fmt.Printf("[Pipeline] UserID extraído (user_id): %s\n", userID)
		return userID
	}
	if id, ok := claims["sub"]; ok {
		userID := fmt.Sprintf("%v", id)
		fmt.Printf("[Pipeline] UserID extraído (sub): %s\n", userID)
		return userID
	}

	fmt.Printf("[Pipeline] Nenhum user_id/sub encontrado nos claims: %v\n", claims)
	return ""
}

func (h *PipelineHandler) GenerateAIPipeline(c *fiber.Ctx) error {
	fmt.Println("[PipelineHandler] 🚀 Iniciando GenerateAIPipeline")
	type Request struct {
		Niche string `json:"niche"`
	}

	var req Request
	if err := c.BodyParser(&req); err != nil {
		fmt.Printf("[PipelineHandler] ❌ Erro no BodyParser: %v\n", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	fmt.Printf("[PipelineHandler] 🔎 Nicho recebido: %s\n", req.Niche)
	if req.Niche == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Campo 'niche' é obrigatório"})
	}

	userID := getUserIDFromToken(c)
	if userID == "" {
		fmt.Println("[PipelineHandler] ❌ UserID não encontrado no token")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User ID not found in token"})
	}

	// 1. Gera do Gemini
	fmt.Println("[PipelineHandler] 🤖 Chamando AIService.GeneratePipelineStages")
	aiPipeline, err := h.aiService.GeneratePipelineStages(req.Niche)
	if err != nil {
		fmt.Printf("[PipelineHandler] ❌ Erro na geração da IA: %v\n", err)
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
	fmt.Printf("[PipelineHandler] 💾 Salvando pipeline para o usuário: %v (name: %s, stages: %d)\n", userID, pipeline.Name, len(pipeline.Stages))
	if err := h.pipelineRepo.SavePipeline(pipeline); err != nil {
		fmt.Printf("[PipelineHandler] ❌ ERRO GORM ao salvar no banco: %v\n", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Falha ao salvar pipeline no banco", "details": err.Error()})
	}
	fmt.Printf("[PipelineHandler] ✅ Pipeline salvo com sucesso! ID: %s\n", pipeline.ID)

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

	return c.JSON(pipeline)
}

func (h *PipelineHandler) DeletePipeline(c *fiber.Ctx) error {
	userID := getUserIDFromToken(c)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User ID not found in token"})
	}

	if err := h.pipelineRepo.DeletePipeline(userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete pipeline: " + err.Error()})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *PipelineHandler) CreatePipeline(c *fiber.Ctx) error {
	type StageReq struct {
		Name  string `json:"name"`
		Order int    `json:"order"`
		Color string `json:"color"`
	}
	type Request struct {
		Name   string     `json:"name"`
		Stages []StageReq `json:"stages"`
	}

	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Name == "" || len(req.Stages) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name and at least one stage are required"})
	}

	userID := getUserIDFromToken(c)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User ID not found in token"})
	}

	pipeline := &domain.Pipeline{
		UserID: userID,
		Name:   req.Name,
	}
	for _, s := range req.Stages {
		pipeline.Stages = append(pipeline.Stages, domain.PipelineStage{
			Name:  s.Name,
			Order: s.Order,
			Color: s.Color,
		})
	}

	if err := h.pipelineRepo.SavePipeline(pipeline); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save pipeline", "details": err.Error()})
	}

	return c.JSON(pipeline)
}
