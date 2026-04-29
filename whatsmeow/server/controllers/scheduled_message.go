package controllers

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/repositories/scheduled_messages"
	"github.com/verbeux-ai/whatsmiau/server/dto"
	"github.com/verbeux-ai/whatsmiau/utils"
)

type ScheduledMessage struct {
	repo interfaces.ScheduledMessageRepository
}

func NewScheduledMessage(repo interfaces.ScheduledMessageRepository) *ScheduledMessage {
	return &ScheduledMessage{repo: repo}
}

func (s *ScheduledMessage) List(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		if q := c.QueryParam("company_id"); q != "" {
			if role, _ := c.Get("user_role").(string); role == "super_admin" {
				companyID = q
			}
		}
	}
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}
	list, err := s.repo.ListByCompanyID(c.Request().Context(), companyID)
	if err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to list scheduled messages")
	}
	return c.JSON(http.StatusOK, list)
}

func (s *ScheduledMessage) Create(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}
	var req dto.CreateScheduledMessageRequest
	if err := c.Bind(&req); err != nil {
		return utils.HTTPFail(c, http.StatusUnprocessableEntity, err, "invalid body")
	}
	if err := validator.New().Struct(&req); err != nil {
		return utils.HTTPFail(c, http.StatusBadRequest, err, "validation failed")
	}
	number := strings.TrimSpace(strings.ReplaceAll(req.Number, " ", ""))
	if number == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "number is required")
	}
	scheduledAt, err := time.Parse(time.RFC3339, req.ScheduledAt)
	if err != nil {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "scheduled_at must be ISO8601 (e.g. 2025-03-15T14:30:00Z)")
	}
	if scheduledAt.Before(time.Now()) {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "scheduled_at must be in the future")
	}
	msgType := strings.ToLower(strings.TrimSpace(req.MessageType))
	if msgType != "text" && msgType != "image" && msgType != "audio" && msgType != "document" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "message_type must be text, image, audio or document")
	}
	if msgType != "text" && strings.TrimSpace(req.MediaURL) == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "media_url is required for image, audio and document")
	}
	m := &models.ScheduledMessage{
		CompanyID:   companyID,
		InstanceID:  req.InstanceID,
		RemoteJID:   number,
		MessageType: msgType,
		Content:     strings.TrimSpace(req.Content),
		MediaURL:    strings.TrimSpace(req.MediaURL),
		ScheduledAt: scheduledAt,
		Status:      "pending",
	}
	if err := s.repo.Create(c.Request().Context(), m); err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to create scheduled message")
	}
	return c.JSON(http.StatusCreated, m)
}

func (s *ScheduledMessage) Cancel(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}
	id := c.Param("id")
	if id == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "id required")
	}
	ctx := c.Request().Context()
	existing, err := s.repo.GetByID(ctx, id, companyID)
	if err != nil {
		if err == scheduled_messages.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, nil, "scheduled message not found")
		}
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to get scheduled message")
	}
	if existing.Status != "pending" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "only pending messages can be cancelled")
	}
	if err := s.repo.Delete(ctx, id, companyID); err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to cancel")
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "cancelled"})
}
