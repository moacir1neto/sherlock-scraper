package handlers

import (
	"encoding/csv"
	"fmt"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
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

	err = h.service.ImportCSV(c.Context(), records, nicho, nil)
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

func (h *LeadHandler) UpdateLead(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id parameter is required"})
	}

	var lead domain.Lead
	if err := c.BodyParser(&lead); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	parsedID, err := uuid.Parse(id)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id format"})
	}
	lead.ID = parsedID

	err = h.service.UpdateLead(c.Context(), &lead)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "lead updated successfully", "lead": lead})
}

func (h *LeadHandler) CreateLead(c *fiber.Ctx) error {
	type Request struct {
		CompanyName    string  `json:"company_name"`
		StageID        string  `json:"stage_id"`
		Nicho          string  `json:"nicho"`
		EstimatedValue float64 `json:"estimated_value"`
		DueDate        string  `json:"due_date"`
		Tags           string  `json:"tags"`
		LinkedLeadID   string  `json:"linked_lead_id"`
	}

	fmt.Printf("[CreateLead] Raw body: %s\n", string(c.Body()))
	fmt.Printf("[CreateLead] Content-Type: %s\n", c.Get("Content-Type"))

	var req Request
	if err := c.BodyParser(&req); err != nil {
		fmt.Printf("[CreateLead] BodyParser error: %v\n", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
	}

	fmt.Printf("[CreateLead] Parsed request: company=%s stage=%s value=%.2f date=%s tags=%s\n",
		req.CompanyName, req.StageID, req.EstimatedValue, req.DueDate, req.Tags)

	if req.CompanyName == "" || req.StageID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Company Name and Stage ID are required"})
	}

	lead := &domain.Lead{
		ID:             uuid.New(),
		Empresa:        req.CompanyName,
		KanbanStatus:   domain.KanbanStatus(req.StageID),
		Nicho:          req.Nicho,
		Status:         domain.StatusCapturado,
		EstimatedValue: req.EstimatedValue,
		Tags:           req.Tags,
	}

	if req.DueDate != "" {
		parsed, err := time.Parse("2006-01-02", req.DueDate)
		if err != nil {
			fmt.Printf("[CreateLead] DueDate parse error: %v (input: %s)\n", err, req.DueDate)
		} else {
			lead.DueDate = &parsed
		}
	}

	if req.LinkedLeadID != "" {
		parsed, err := uuid.Parse(req.LinkedLeadID)
		if err != nil {
			fmt.Printf("[CreateLead] LinkedLeadID parse error: %v (input: %s)\n", err, req.LinkedLeadID)
		} else {
			lead.LinkedLeadID = &parsed
		}
	}

	if err := h.service.CreateLead(c.Context(), lead); err != nil {
		fmt.Printf("[CreateLead] Service error: %v\n", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create lead", "details": err.Error()})
	}

	fmt.Printf("[CreateLead] Lead created successfully: ID=%s Empresa=%s\n", lead.ID, lead.Empresa)
	return c.Status(fiber.StatusCreated).JSON(lead)
}
