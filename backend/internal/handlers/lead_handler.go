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
		return h.HandleIDRequired(c)
	}

	var lead domain.Lead
	if err := h.ParserLead(c, &lead); err != nil {
		return err
	}

	parsedID, err := uuid.Parse(id)
	if err != nil {
		return h.HandleInvalidID(c)
	}
	lead.ID = parsedID

	err = h.service.UpdateLead(c.Context(), &lead)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "lead updated successfully", "lead": lead})
}

func (h *LeadHandler) DeleteLead(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id parameter is required"})
	}

	err := h.service.DeleteLead(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete lead", "details": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Lead deleted successfully"})
}

func (h *LeadHandler) HandleIDRequired(c *fiber.Ctx) error {
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id parameter is required"})
}

func (h *LeadHandler) HandleInvalidID(c *fiber.Ctx) error {
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id format"})
}

func (h *LeadHandler) ParserLead(c *fiber.Ctx, lead *domain.Lead) error {
	if err := c.BodyParser(lead); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	return nil
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
		Endereco       string  `json:"endereco"`
		Telefone       string  `json:"telefone"`
		TipoTelefone   string  `json:"tipo_telefone"`
		Email          string  `json:"email"`
		Site           string  `json:"site"`
		Instagram      string  `json:"instagram"`
		Facebook       string  `json:"facebook"`
		LinkedIn       string  `json:"linkedin"`
		TikTok         string  `json:"tiktok"`
		YouTube        string  `json:"youtube"`
		ResumoNegocio  string  `json:"resumo_negocio"`
		Rating         string  `json:"rating"`
		QtdAvaliacoes  string  `json:"qtd_avaliacoes"`
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
		Endereco:       req.Endereco,
		Telefone:       req.Telefone,
		TipoTelefone:   req.TipoTelefone,
		Email:          req.Email,
		Site:           req.Site,
		Instagram:      req.Instagram,
		Facebook:       req.Facebook,
		LinkedIn:       req.LinkedIn,
		TikTok:         req.TikTok,
		YouTube:        req.YouTube,
		ResumoNegocio:  req.ResumoNegocio,
		Rating:         req.Rating,
		QtdAvaliacoes:  req.QtdAvaliacoes,
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

			// Inherit data from linked lead if available
			linkedLead, err := h.service.GetLead(c.Context(), parsed.String())
			if err == nil && linkedLead != nil {
				// Inherit ai_analysis
				if len(linkedLead.AIAnalysis) > 0 {
					lead.AIAnalysis = linkedLead.AIAnalysis
				}
				// Inherit contact & company data (only if not provided in the request)
				if lead.Endereco == "" && linkedLead.Endereco != "" {
					lead.Endereco = linkedLead.Endereco
				}
				if lead.Telefone == "" && linkedLead.Telefone != "" {
					lead.Telefone = linkedLead.Telefone
					lead.TipoTelefone = linkedLead.TipoTelefone
				}
				if lead.LinkWhatsapp == "" && linkedLead.LinkWhatsapp != "" {
					lead.LinkWhatsapp = linkedLead.LinkWhatsapp
				}
				if lead.Email == "" && linkedLead.Email != "" {
					lead.Email = linkedLead.Email
				}
				if lead.Site == "" && linkedLead.Site != "" {
					lead.Site = linkedLead.Site
				}
				if lead.Instagram == "" && linkedLead.Instagram != "" {
					lead.Instagram = linkedLead.Instagram
				}
				if lead.Facebook == "" && linkedLead.Facebook != "" {
					lead.Facebook = linkedLead.Facebook
				}
				if lead.LinkedIn == "" && linkedLead.LinkedIn != "" {
					lead.LinkedIn = linkedLead.LinkedIn
				}
				if lead.TikTok == "" && linkedLead.TikTok != "" {
					lead.TikTok = linkedLead.TikTok
				}
				if lead.YouTube == "" && linkedLead.YouTube != "" {
					lead.YouTube = linkedLead.YouTube
				}
				if lead.ResumoNegocio == "" && linkedLead.ResumoNegocio != "" {
					lead.ResumoNegocio = linkedLead.ResumoNegocio
				}
				if lead.Rating == "" && linkedLead.Rating != "" {
					lead.Rating = linkedLead.Rating
				}
				if lead.QtdAvaliacoes == "" && linkedLead.QtdAvaliacoes != "" {
					lead.QtdAvaliacoes = linkedLead.QtdAvaliacoes
				}
				if lead.Nicho == "" && linkedLead.Nicho != "" {
					lead.Nicho = linkedLead.Nicho
				}
				if !lead.TemPixel && linkedLead.TemPixel {
					lead.TemPixel = linkedLead.TemPixel
				}
				if !lead.TemGTM && linkedLead.TemGTM {
					lead.TemGTM = linkedLead.TemGTM
				}
				if lead.DeepData == nil && linkedLead.DeepData != nil {
					lead.DeepData = linkedLead.DeepData
				}
				if lead.CNPJ == "" && linkedLead.CNPJ != "" {
					lead.CNPJ = linkedLead.CNPJ
				}
				fmt.Printf("[CreateLead] Inherited data from linked lead %s\n", parsed.String())
			}
		}
	}

	if err := h.service.CreateLead(c.Context(), lead); err != nil {
		fmt.Printf("[CreateLead] Service error: %v\n", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create lead", "details": err.Error()})
	}

	fmt.Printf("[CreateLead] Lead created successfully: ID=%s Empresa=%s\n", lead.ID, lead.Empresa)
	return c.Status(fiber.StatusCreated).JSON(lead)
}

type BulkSendReq struct {
	Leads      []ports.BulkSendLead `json:"leads"`
	InstanceID string               `json:"instance_id"`
}

func (h *LeadHandler) BulkSend(c *fiber.Ctx) error {
	var req BulkSendReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if len(req.Leads) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "leads array is required"})
	}

	if req.InstanceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "instance_id is required"})
	}

	campaignID := uuid.New().String()

	enqueued, err := h.service.EnqueueBulkSend(c.Context(), req.Leads, req.InstanceID, campaignID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"campaign_id": campaignID,
		"message":     fmt.Sprintf("%d mensagens enfileiradas com sucesso", enqueued),
		"enqueued":    enqueued,
		"total":       len(req.Leads),
	})
}
