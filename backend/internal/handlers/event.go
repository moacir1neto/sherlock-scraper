package handlers

import (
	"net/http"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type EventHandler struct {
	service *services.EventService
}

func NewEventHandler(service *services.EventService) *EventHandler {
	return &EventHandler{service: service}
}

type createEventRequest struct {
	CompanyID   string                 `json:"company_id"` // Opcional para override/teste
	LeadID      string                 `json:"lead_id" validate:"required,uuid"`
	LeadName    string                 `json:"lead_name" validate:"required"`
	ScheduledAt string                 `json:"scheduled_at" validate:"required"` // format: RFC3339
	Metadata    map[string]interface{} `json:"metadata"`
}

// CreateMeeting agenda uma nova reunião e notifica o painel via SSE.
func (h *EventHandler) CreateMeeting(c *fiber.Ctx) error {
	var companyID uuid.UUID
	
	var req createEventRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	// 1. Ordem de precedência para CompanyID: Corpo > JWT Locals > uuid.Nil
	if req.CompanyID != "" {
		companyID, _ = uuid.Parse(req.CompanyID)
	} else if companyIDLocals := c.Locals("company_id"); companyIDLocals != nil {
		companyID, _ = uuid.Parse(companyIDLocals.(string))
	} else {
		companyID = uuid.Nil
	}

	leadID, err := uuid.Parse(req.LeadID)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid lead_id"})
	}

	scheduledAt, err := time.Parse(time.RFC3339, req.ScheduledAt)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid scheduled_at format (RFC3339 required)"})
	}

	event, err := h.service.CreateMeetingScheduled(c.Context(), companyID, leadID, req.LeadName, scheduledAt, req.Metadata)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(http.StatusCreated).JSON(event)
}

// CancelEvent cancela um evento e remove lembretes agendados.
func (h *EventHandler) CancelEvent(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "event id is required"})
	}

	if err := h.service.CancelMeeting(c.Context(), id); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "event canceled successfully"})
}

// GetLeadEvents lista todos os eventos de um lead específico.
func (h *EventHandler) GetLeadEvents(c *fiber.Ctx) error {
	leadIDStr := c.Params("id")
	leadID, err := uuid.Parse(leadIDStr)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid lead id"})
	}

	events, err := h.service.ListEventsByLead(c.Context(), leadID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"events": events})
}
