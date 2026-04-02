package controllers

import (
	"io"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/lib/whatsmiau"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

// WebhookInstance handles webhook-inbox and webhook-send-test for a given instance.
type WebhookInstance struct {
	instanceRepo   interfaces.InstanceRepository
	webhookLogRepo interfaces.WebhookLogRepository
	whatsmiau      *whatsmiau.Whatsmiau
}

func NewWebhookInstance(instanceRepo interfaces.InstanceRepository, webhookLogRepo interfaces.WebhookLogRepository, w *whatsmiau.Whatsmiau) *WebhookInstance {
	return &WebhookInstance{
		instanceRepo:   instanceRepo,
		webhookLogRepo: webhookLogRepo,
		whatsmiau:      w,
	}
}

// WebhookInbox receives a POST with arbitrary body, validates JWT and instance ownership, saves to webhook_logs with event_type=inbox.
func (s *WebhookInstance) WebhookInbox(ctx echo.Context) error {
	id := ctx.Param("id")
	if id == "" {
		return utils.HTTPFail(ctx, http.StatusBadRequest, nil, "instance id required")
	}

	c := ctx.Request().Context()
	list, err := s.instanceRepo.List(c, id)
	if err != nil || len(list) == 0 {
		return utils.HTTPFail(ctx, http.StatusNotFound, err, "instance not found")
	}
	instance := list[0]

	// Admin: instance must belong to user's company. Super_admin: any.
	companyID, _ := ctx.Get("company_id").(string)
	role, _ := ctx.Get("role").(string)
	if role != "super_admin" && companyID != "" {
		if instance.CompanyID == nil || *instance.CompanyID != companyID {
			return utils.HTTPFail(ctx, http.StatusForbidden, nil, "instance does not belong to your company")
		}
	}

	body, err := io.ReadAll(ctx.Request().Body)
	if err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "failed to read body")
	}
	bodyStr := string(body)
	if len(bodyStr) > 2048 {
		bodyStr = bodyStr[:2048]
	}

	var companyIDPtr *string
	if instance.CompanyID != nil {
		companyIDPtr = instance.CompanyID
	}
	status := 200
	log := &models.WebhookLog{
		InstanceID:     instance.ID,
		CompanyID:      companyIDPtr,
		EventType:      "inbox",
		URL:            "",
		RequestBody:    bodyStr,
		ResponseStatus: &status,
		CreatedAt:      time.Now(),
	}
	if err := s.webhookLogRepo.Create(c, log); err != nil {
		zap.L().Warn("failed to record webhook inbox log", zap.Error(err))
	}

	return ctx.JSON(http.StatusOK, map[string]bool{"received": true})
}

// WebhookSendTest sends a test event (type "connected" with test payload) to the instance's webhook URL and returns the result.
func (s *WebhookInstance) WebhookSendTest(ctx echo.Context) error {
	id := ctx.Param("id")
	if id == "" {
		return utils.HTTPFail(ctx, http.StatusBadRequest, nil, "instance id required")
	}

	c := ctx.Request().Context()
	list, err := s.instanceRepo.List(c, id)
	if err != nil || len(list) == 0 {
		return utils.HTTPFail(ctx, http.StatusNotFound, err, "instance not found")
	}
	instance := list[0]

	companyID, _ := ctx.Get("company_id").(string)
	role, _ := ctx.Get("role").(string)
	if role != "super_admin" && companyID != "" {
		if instance.CompanyID == nil || *instance.CompanyID != companyID {
			return utils.HTTPFail(ctx, http.StatusForbidden, nil, "instance does not belong to your company")
		}
	}

	if instance.Webhook.Url == "" {
		return utils.HTTPFail(ctx, http.StatusBadRequest, nil, "webhook URL not configured for this instance")
	}

	companyIDStr := ""
	if instance.CompanyID != nil {
		companyIDStr = *instance.CompanyID
	}
	payload := map[string]interface{}{
		"test":      true,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	s.whatsmiau.EmitEnvelope(instance.ID, companyIDStr, "connected", instance.Webhook.Url, instance.Webhook.Secret, payload)

	// The actual HTTP send is async; we return 200. Client can check webhook-logs for delivery status.
	return ctx.JSON(http.StatusOK, map[string]interface{}{
		"message": "test event sent to webhook URL",
		"status":  http.StatusOK,
	})
}
