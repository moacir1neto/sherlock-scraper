package handlers

import (
	"fmt"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/logger"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/repositories"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
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
		logger.FromContext(c.UserContext()).Warn("pipeline_locals_user_nil")
		return ""
	}

	userToken, ok := localUser.(*jwt.Token)
	if !ok {
		logger.FromContext(c.UserContext()).Warn("pipeline_locals_user_type_error", zap.String("type", fmt.Sprintf("%T", localUser)))
		return ""
	}

	claims, ok := userToken.Claims.(jwt.MapClaims)
	if !ok {
		logger.FromContext(c.UserContext()).Warn("pipeline_token_claims_cast_error")
		return ""
	}

	// Normal claim locations for user ID
	if id, ok := claims["user_id"]; ok {
		userID := fmt.Sprintf("%v", id)
		logger.FromContext(c.UserContext()).Debug("user_id_extraido", zap.String("source", "user_id"), zap.String("user_id", userID))
		return userID
	}
	if id, ok := claims["sub"]; ok {
		userID := fmt.Sprintf("%v", id)
		logger.FromContext(c.UserContext()).Debug("user_id_extraido", zap.String("source", "sub"), zap.String("user_id", userID))
		return userID
	}

	logger.FromContext(c.UserContext()).Warn("user_id_nao_encontrado_nos_claims")
	return ""
}

func (h *PipelineHandler) GenerateAIPipeline(c *fiber.Ctx) error {
	ctx := c.UserContext()
	l := logger.FromContext(ctx)
	l.Info("iniciando_generate_ai_pipeline")
	type Request struct {
		Niche string `json:"niche"`
	}

	var req Request
	if err := c.BodyParser(&req); err != nil {
		l.Error("erro_body_parser_pipeline", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	l.Info("nicho_recebido_pipeline", zap.String("niche", req.Niche))
	if req.Niche == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Campo 'niche' é obrigatório"})
	}

	userID := getUserIDFromToken(c)
	if userID == "" {
		l.Warn("unauthorized_pipeline_no_user_id")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User ID not found in token"})
	}

	// 1. Gera do Gemini
	l.Info("chamando_ai_service_pipeline")
	aiPipeline, err := h.aiService.GeneratePipelineStages(req.Niche)
	if err != nil {
		l.Error("erro_geracao_ia_pipeline", zap.Error(err))
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
	l.Info("salvando_pipeline_db", zap.String("user_id", userID), zap.String("name", pipeline.Name), zap.Int("stages", len(pipeline.Stages)))
	if err := h.pipelineRepo.SavePipeline(pipeline); err != nil {
		l.Error("erro_gorm_salvar_pipeline", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Falha ao salvar pipeline no banco", "details": err.Error()})
	}
	l.Info("pipeline_salvo_sucesso", zap.String("id", pipeline.ID))

	return c.JSON(pipeline)
}

func (h *PipelineHandler) GetPipeline(c *fiber.Ctx) error {
	userID := getUserIDFromToken(c)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User ID not found in token"})
	}

	// Support fetching by specific ID via query param
	pipelineID := c.Query("id")
	if pipelineID != "" {
		pipeline, err := h.pipelineRepo.GetPipelineByID(pipelineID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(pipeline)
	}

	pipeline, err := h.pipelineRepo.GetPipelineByUserID(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(pipeline)
}

func (h *PipelineHandler) GetAllPipelines(c *fiber.Ctx) error {
	userID := getUserIDFromToken(c)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User ID not found in token"})
	}

	pipelines, err := h.pipelineRepo.GetAllPipelinesByUserID(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"pipelines": pipelines})
}

func (h *PipelineHandler) DeletePipeline(c *fiber.Ctx) error {
	userID := getUserIDFromToken(c)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User ID not found in token"})
	}

	pipelineID := c.Query("id")
	if err := h.pipelineRepo.DeletePipeline(userID, pipelineID); err != nil {
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

func (h *PipelineHandler) AddStage(c *fiber.Ctx) error {
	type Request struct {
		PipelineID string `json:"pipeline_id"`
		Name       string `json:"name"`
		Color      string `json:"color"`
	}

	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.PipelineID == "" || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Pipeline ID and Name are required"})
	}

	stage := &domain.PipelineStage{
		Name:  req.Name,
		Color: req.Color,
	}
	if stage.Color == "" {
		stage.Color = "#3b82f6" // Default blue
	}

	if err := h.pipelineRepo.AddStage(req.PipelineID, stage); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to add stage", "details": err.Error()})
	}

	return c.JSON(stage)
}
