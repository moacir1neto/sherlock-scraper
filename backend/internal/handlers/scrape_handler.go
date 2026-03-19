package handlers

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ScrapeStatus string

const (
	StatusRunning ScrapeStatus = "running"
	StatusDone    ScrapeStatus = "done"
	StatusError   ScrapeStatus = "error"
)

type ScrapeJob struct {
	ID        string
	Status    ScrapeStatus
	Output    string
	StartedAt time.Time
}

type ScrapeHandler struct {
	mu      sync.RWMutex
	jobs    map[string]*ScrapeJob
	service ports.LeadService
}

func NewScrapeHandler(service ports.LeadService) *ScrapeHandler {
	return &ScrapeHandler{
		jobs:    make(map[string]*ScrapeJob),
		service: service,
	}
}

type ScrapeRequest struct {
	Nicho      string `json:"nicho"`
	Localizacao string `json:"localizacao"`
}

func (h *ScrapeHandler) Start(c *fiber.Ctx) error {
	var req ScrapeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.Nicho == "" || req.Localizacao == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "nicho and localizacao are required"})
	}

	jobID := uuid.New().String()
	job := &ScrapeJob{
		ID:        jobID,
		Status:    StatusRunning,
		StartedAt: time.Now(),
	}

	h.mu.Lock()
	h.jobs[jobID] = job
	h.mu.Unlock()

	// Run in background
	go func() {
		var outBuf bytes.Buffer
		var errBuf bytes.Buffer

		// Run sherlock container with CLI args
		cmd := exec.Command(
			"docker", "compose",
			"-f", "/workspace/docker-compose.yml",
			"run", "--rm",
			"-e", fmt.Sprintf("SHERLOCK_NICHO=%s", req.Nicho),
			"-e", fmt.Sprintf("SHERLOCK_LOCALIZACAO=%s", req.Localizacao),
			"sherlock",
			"python", "main.py",
			"--nicho", req.Nicho,
			"--localizacao", req.Localizacao,
		)
		cmd.Stdout = &outBuf
		cmd.Stderr = &errBuf

		err := cmd.Run()

		h.mu.Lock()
		defer h.mu.Unlock()

		if err != nil {
			job.Status = StatusError
			job.Output = errBuf.String()
			if job.Output == "" {
				job.Output = err.Error()
			}
		} else {
			job.Status = StatusDone
			job.Output = outBuf.String()

			// Insere automaticamente os leads CSV no PostgreSQL
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
					h.service.ImportCSV(context.Background(), records, req.Nicho)
				}
			}
		}
	}()

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"job_id":  jobID,
		"message": "Scraping job started successfully",
	})
}

func (h *ScrapeHandler) Status(c *fiber.Ctx) error {
	jobID := c.Query("job_id")
	if jobID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "job_id query param is required"})
	}

	h.mu.RLock()
	job, ok := h.jobs[jobID]
	h.mu.RUnlock()

	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "job not found"})
	}

	return c.JSON(fiber.Map{
		"job_id":  job.ID,
		"status":  job.Status,
		"output":  job.Output,
		"elapsed": time.Since(job.StartedAt).Round(time.Second).String(),
	})
}
