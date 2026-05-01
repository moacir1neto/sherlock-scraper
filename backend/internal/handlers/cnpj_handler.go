package handlers

import (
	"log"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/services"
	"github.com/gofiber/fiber/v2"
)

type CNPJHandler struct {
	cnpjService *services.CNPJService
}

func NewCNPJHandler(cnpjService *services.CNPJService) *CNPJHandler {
	return &CNPJHandler{cnpjService: cnpjService}
}

// EnrichCNPJ busca o CNPJ de um lead pelo nome da empresa
// POST /api/v1/protected/leads/:id/enrich-cnpj
func (h *CNPJHandler) EnrichCNPJ(c *fiber.Ctx) error {
	leadID := c.Params("id")
	if leadID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "lead id is required",
		})
	}

	log.Printf("🔍 Recebido pedido de busca de CNPJ para lead: %s", leadID)

	result, err := h.cnpjService.EnrichCNPJ(leadID)
	if err != nil {
		log.Printf("❌ Erro ao buscar CNPJ para o lead %s: %v", leadID, err)
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"success": false,
			"error":   "cnpj_not_found",
			"message": "Não foi possível localizar o CNPJ automaticamente para esta empresa.",
		})
	}

	return c.JSON(fiber.Map{
		"message": "CNPJ encontrado com sucesso",
		"lead_id": leadID,
		"result":  result,
	})
}

// ValidateCNPJ valida um CNPJ usando a BrasilAPI (Receita Federal)
// POST /api/v1/protected/leads/:id/validate-cnpj
func (h *CNPJHandler) ValidateCNPJ(c *fiber.Ctx) error {
	type Request struct {
		CNPJ string `json:"cnpj"`
	}

	var req Request
	if err := c.BodyParser(&req); err != nil || req.CNPJ == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "cnpj is required",
		})
	}

	result, err := h.cnpjService.ValidateCNPJ(req.CNPJ)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "cnpj_invalid",
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "CNPJ válido",
		"result":  result,
	})
}
