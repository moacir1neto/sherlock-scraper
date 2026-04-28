package controllers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/repositories/ai_settings"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

type AISettingsController struct {
	repo *ai_settings.SQLAISettings
}

func NewAISettings(repo *ai_settings.SQLAISettings) *AISettingsController {
	return &AISettingsController{repo: repo}
}

// Get retorna as configurações de IA da empresa autenticada.
// GET /v1/admin/ai-settings
func (c *AISettingsController) Get(ctx echo.Context) error {
	companyID, _ := ctx.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(ctx, http.StatusForbidden, nil, "company_id required")
	}

	settings, err := c.repo.GetByCompanyID(ctx.Request().Context(), companyID)
	if err != nil {
		zap.L().Error("failed to get ai_settings", zap.String("company_id", companyID), zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to get AI settings")
	}
	return ctx.JSON(http.StatusOK, settings)
}

// Save insere ou atualiza as configurações de IA da empresa autenticada.
// PUT /v1/admin/ai-settings
func (c *AISettingsController) Save(ctx echo.Context) error {
	companyID, _ := ctx.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(ctx, http.StatusForbidden, nil, "company_id required")
	}

	var body struct {
		CompanyName       string `json:"company_name"`
		Nicho             string `json:"nicho"`
		Oferta            string `json:"oferta"`
		TomDeVoz          string `json:"tom_de_voz"`
		AgentEnabled      bool   `json:"agent_enabled"`
		AgentSystemPrompt string `json:"agent_system_prompt"`
	}
	if err := ctx.Bind(&body); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "invalid body")
	}

	settings := &models.AISettings{
		CompanyID:         companyID,
		CompanyName:       body.CompanyName,
		Nicho:             body.Nicho,
		Oferta:            body.Oferta,
		TomDeVoz:          body.TomDeVoz,
		AgentEnabled:      body.AgentEnabled,
		AgentSystemPrompt: body.AgentSystemPrompt,
	}

	if err := c.repo.Upsert(ctx.Request().Context(), settings); err != nil {
		zap.L().Error("failed to save ai_settings", zap.String("company_id", companyID), zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to save AI settings")
	}

	return ctx.JSON(http.StatusOK, settings)
}
