package handlers

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
	"github.com/digitalcombo/sherlock-scraper/backend/pkg/csvparser"
	"github.com/gofiber/fiber/v2"
)

type ScrapeHandler struct {
	service ports.LeadService
}

func NewScrapeHandler(service ports.LeadService) *ScrapeHandler {
	return &ScrapeHandler{
		service: service,
	}
}

type ScrapeRequest struct {
	Nicho       string `json:"nicho"`
	Localizacao string `json:"localizacao"`
	Limit       int    `json:"limit"`
}

func (h *ScrapeHandler) Start(c *fiber.Ctx) error {
	var req ScrapeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.Nicho == "" || req.Localizacao == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "nicho and localizacao are required"})
	}

	if req.Limit <= 0 {
		req.Limit = 20
	}

	// 1. Cria o ScrapingJob no Banco de Dados
	job, err := h.service.CreateJob(c.Context(), req.Nicho, req.Localizacao)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create scraping job"})
	}

	jobID := job.ID.String()

	// 2. Executa em background
	go func() {
		var combinedBuf bytes.Buffer

		// Run sherlock container with CLI args
		cmd := exec.Command(
			"docker",
			"compose",
			"-f", "/workspace/docker-compose.yml",
			"run", "--rm",
			"-e", fmt.Sprintf("SHERLOCK_NICHO=%s", req.Nicho),
			"-e", fmt.Sprintf("SHERLOCK_LOCALIZACAO=%s", req.Localizacao),
			"sherlock",
			"python", "main.py",
			"--nicho", req.Nicho,
			"--localizacao", req.Localizacao,
			"--limit", fmt.Sprintf("%d", req.Limit),
		)
		
		// Captura stdout e stderr juntos para logs
		cmd.Stdout = &combinedBuf
		cmd.Stderr = &combinedBuf

		cmdErr := cmd.Run()

		// 3. Atualiza o status e logs no Banco
		job.Logs = combinedBuf.String()
		if cmdErr != nil {
			job.Status = domain.ScrapeError
			if job.Logs == "" {
				job.Logs = cmdErr.Error()
			}
		} else {
			// 4. Insere automaticamente os leads CSV vinculados ao JobID
			nichoFmt := strings.ReplaceAll(req.Nicho, " ", "_")
			cidadeFmt := strings.ReplaceAll(req.Localizacao, " ", "_")
			fileName := fmt.Sprintf("/workspace/leads_%s_%s.csv", nichoFmt, cidadeFmt)

			if file, errFile := os.Open(fileName); errFile == nil {
				defer file.Close()
				reader := csv.NewReader(file)
				reader.Comma = ';'
				reader.LazyQuotes = true
				reader.FieldsPerRecord = -1
				if records, errCsv := reader.ReadAll(); errCsv == nil {
					h.service.ImportCSV(context.Background(), records, req.Nicho, &jobID)
				}
			}
			// Job moves to ENRICHING — completion is triggered by the enrichment
			// worker once ALL leads reach a terminal enrichment status.
			job.Status = domain.ScrapeEnriching
			log.Printf("📋 [Scrape] Job %s → ENRICHING (aguardando enriquecimento dos leads)", jobID)
		}

		h.service.UpdateJob(context.Background(), job)
	}()

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"job_id":  jobID,
		"message": "Scraping campaign started successfully",
	})
}

func (h *ScrapeHandler) ListScrapes(c *fiber.Ctx) error {
	jobs, err := h.service.ListJobs(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list scraping jobs"})
	}
	return c.JSON(fiber.Map{"jobs": jobs})
}

func (h *ScrapeHandler) GetLeadsByJob(c *fiber.Ctx) error {
	jobID := c.Params("id")
	leads, err := h.service.GetLeadsByJob(c.Context(), jobID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch leads for this campaign"})
	}
	return c.JSON(fiber.Map{"leads": leads})
}

func (h *ScrapeHandler) Status(c *fiber.Ctx) error {
	jobID := c.Query("job_id")
	if jobID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "job_id query param is required"})
	}

	job, err := h.service.GetJob(c.Context(), jobID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "job not found"})
	}

	return c.JSON(fiber.Map{
		"job_id":  job.ID,
		"status":  job.Status,
		"logs":    job.Logs,
		"elapsed": time.Since(job.CreatedAt).Round(time.Second).String(),
	})
}

func (h *ScrapeHandler) DeleteJob(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id is required"})
	}

	if err := h.service.DeleteJob(c.Context(), id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete scraping job"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// ScrapeSyncRequest is the payload for the internal synchronous scrape endpoint.
// Uses "keyword" and "location" to match WhatsMiau's field naming convention.
type ScrapeSyncRequest struct {
	Keyword  string `json:"keyword"`
	Location string `json:"location"`
	Limit    int    `json:"limit"`
}

// syncLeadDTO maps domain.Lead fields to the naming convention expected by WhatsMiau.
type syncLeadDTO struct {
	Name     string          `json:"name"`
	Phone    string          `json:"phone"`
	Address  string          `json:"address,omitempty"`
	Website  string          `json:"website,omitempty"`
	Rating   string          `json:"rating,omitempty"`
	Reviews  string          `json:"reviews,omitempty"`
	DeepData json.RawMessage `json:"deep_data,omitempty"`
}

// StartSync runs the scraping pipeline synchronously and returns the parsed leads directly.
// It is intended for internal server-to-server calls only (protected by InternalAuth middleware).
// Returns 200 with the lead array on success, or 500 on scraping failure.
// Times out after 60 seconds.
func (h *ScrapeHandler) StartSync(c *fiber.Ctx) error {
	var req ScrapeSyncRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.Keyword == "" || req.Location == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "keyword and location are required"})
	}

	if req.Limit <= 0 {
		req.Limit = 20
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	var combinedBuf bytes.Buffer
	cmd := exec.CommandContext(ctx,
		"docker",
		"compose",
		"-f", "/workspace/docker-compose.yml",
		"run", "--rm",
		"-e", fmt.Sprintf("SHERLOCK_NICHO=%s", req.Keyword),
		"-e", fmt.Sprintf("SHERLOCK_LOCALIZACAO=%s", req.Location),
		"sherlock",
		"python", "main.py",
		"--nicho", req.Keyword,
		"--localizacao", req.Location,
		"--limit", fmt.Sprintf("%d", req.Limit),
	)
	cmd.Stdout = &combinedBuf
	cmd.Stderr = &combinedBuf

	if err := cmd.Run(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "scraping failed"})
	}

	nichoFmt := strings.ReplaceAll(req.Keyword, " ", "_")
	cidadeFmt := strings.ReplaceAll(req.Location, " ", "_")
	fileName := fmt.Sprintf("/workspace/leads_%s_%s.csv", nichoFmt, cidadeFmt)

	file, err := os.Open(fileName)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read scraping results"})
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.Comma = ';'
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1

	records, err := reader.ReadAll()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to parse scraping results"})
	}

	leads := csvparser.MapToLeads(records, req.Keyword)

	mapped := make([]syncLeadDTO, len(leads))
	for i, l := range leads {
		mapped[i] = syncLeadDTO{
			Name:     l.Empresa,
			Phone:    l.Telefone,
			Address:  l.Endereco,
			Website:  l.Site,
			Rating:   l.Rating,
			Reviews:  l.QtdAvaliacoes,
			DeepData: json.RawMessage(l.DeepData),
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"total": len(mapped), "leads": mapped})
}

// ScrapeAsyncRequest is the payload for the non-blocking internal scrape endpoint.
type ScrapeAsyncRequest struct {
	Keyword  string `json:"keyword"`
	Location string `json:"location"`
	Limit    int    `json:"limit"`
}

// StartAsync creates a ScrapingJob and runs the scraper in a goroutine, returning the
// job_id immediately so the caller can poll StatusWithLeads for the result.
func (h *ScrapeHandler) StartAsync(c *fiber.Ctx) error {
	var req ScrapeAsyncRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.Keyword == "" || req.Location == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "keyword and location are required"})
	}
	if req.Limit <= 0 {
		req.Limit = 20
	}

	job, err := h.service.CreateJob(c.Context(), req.Keyword, req.Location)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create scraping job"})
	}
	jobID := job.ID.String()

	go func() {
		var buf bytes.Buffer
		cmd := exec.Command(
			"docker", "compose", "-f", "/workspace/docker-compose.yml",
			"run", "--rm",
			"-e", fmt.Sprintf("SHERLOCK_NICHO=%s", req.Keyword),
			"-e", fmt.Sprintf("SHERLOCK_LOCALIZACAO=%s", req.Location),
			"sherlock", "python", "main.py",
			"--nicho", req.Keyword,
			"--localizacao", req.Location,
			"--limit", fmt.Sprintf("%d", req.Limit),
		)
		cmd.Stdout = &buf
		cmd.Stderr = &buf
		cmdErr := cmd.Run()
		job.Logs = buf.String()
		if cmdErr != nil {
			job.Status = domain.ScrapeError
			if job.Logs == "" {
				job.Logs = cmdErr.Error()
			}
		} else {
			nichoFmt := strings.ReplaceAll(req.Keyword, " ", "_")
			cidadeFmt := strings.ReplaceAll(req.Location, " ", "_")
			fileName := fmt.Sprintf("/workspace/leads_%s_%s.csv", nichoFmt, cidadeFmt)
			if file, errFile := os.Open(fileName); errFile == nil {
				defer file.Close()
				reader := csv.NewReader(file)
				reader.Comma = ';'
				reader.LazyQuotes = true
				reader.FieldsPerRecord = -1
				if records, errCsv := reader.ReadAll(); errCsv == nil {
					h.service.ImportCSV(context.Background(), records, req.Keyword, &jobID)
				}
			}
			job.Status = domain.ScrapeEnriching
			log.Printf("📋 [Scrape] Job %s → ENRICHING (aguardando enriquecimento dos leads)", jobID)
		}
		h.service.UpdateJob(context.Background(), job)
	}()

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"job_id": jobID})
}

// StatusWithLeads returns the current status of a scraping job. When the job is completed,
// the response also includes the mapped leads in the format expected by WhatsMiau.
func (h *ScrapeHandler) StatusWithLeads(c *fiber.Ctx) error {
	jobID := c.Params("job_id")
	job, err := h.service.GetJob(c.Context(), jobID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "job not found"})
	}

	resp := fiber.Map{
		"job_id":  job.ID,
		"status":  job.Status,
		"elapsed": time.Since(job.CreatedAt).Round(time.Second).String(),
	}

	if job.Status == domain.ScrapeCompleted {
		leads, _ := h.service.GetLeadsByJob(c.Context(), jobID)
		mapped := make([]syncLeadDTO, len(leads))
		for i, l := range leads {
			mapped[i] = syncLeadDTO{
				Name:     l.Empresa,
				Phone:    l.Telefone,
				Address:  l.Endereco,
				Website:  l.Site,
				Rating:   l.Rating,
				Reviews:  l.QtdAvaliacoes,
				DeepData: json.RawMessage(l.DeepData),
			}
		}
		resp["total"] = len(mapped)
		resp["leads"] = mapped
	}

	if job.Status == domain.ScrapeError {
		resp["error"] = job.Logs
	}

	return c.JSON(resp)
}
