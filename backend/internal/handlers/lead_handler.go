package handlers

import (
	"encoding/csv"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
	"github.com/gofiber/fiber/v2"
)

type LeadHandler struct {
	service ports.LeadService
}

func NewLeadHandler(service ports.LeadService) *LeadHandler {
	return &LeadHandler{service: service}
}

func (h *LeadHandler) UploadCSV(c *fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "file is required"})
	}

	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "unable to open file"})
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.Comma = ';'
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1

	records, err := reader.ReadAll()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid csv format: " + err.Error(),
		})
	}

	nicho := c.FormValue("nicho", "Geral")

	err = h.service.ImportCSV(c.Context(), records, nicho)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "CSV imported successfully",
	})
}

func (h *LeadHandler) GetLeads(c *fiber.Ctx) error {
	leads, err := h.service.GetLeads(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "could not fetch leads"})
	}

	return c.JSON(fiber.Map{"leads": leads})
}

type UpdateStatusReq struct {
	Status domain.KanbanStatus `json:"status"`
}

func (h *LeadHandler) UpdateStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id parameter is required"})
	}

	var req UpdateStatusReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	err := h.service.ChangeStatus(c.Context(), id, req.Status)
	if err != nil {
		if err.Error() == "lead not found" {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Lead not found"})
		}
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "status updated successfully"})
}
