package controllers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/repositories/webhook_logs"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

type WebhookLog struct {
	repo interfaces.WebhookLogRepository
}

func NewWebhookLog(repo interfaces.WebhookLogRepository) *WebhookLog {
	return &WebhookLog{repo: repo}
}

func (s *WebhookLog) List(ctx echo.Context) error {
	limit, _ := strconv.Atoi(ctx.QueryParam("limit"))
	offset, _ := strconv.Atoi(ctx.QueryParam("offset"))
	instanceID := ctx.QueryParam("instance_id")
	eventType := ctx.QueryParam("event_type")
	companyID := ctx.QueryParam("company_id")

	// Admin: filter by JWT company_id. Super_admin: may override with query param company_id.
	if companyID == "" {
		if cid, ok := ctx.Get("company_id").(string); ok && cid != "" {
			companyID = cid
		}
	} else {
		// Only super_admin can filter by another company
		if role, _ := ctx.Get("user_role").(string); role != "super_admin" {
			companyID = ""
			if cid, ok := ctx.Get("company_id").(string); ok && cid != "" {
				companyID = cid
			}
		}
	}

	c := ctx.Request().Context()
	list, total, err := s.repo.List(c, instanceID, companyID, eventType, limit, offset)
	if err != nil {
		zap.L().Error("webhook log list failed", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list webhook logs")
	}
	return ctx.JSON(http.StatusOK, map[string]interface{}{
		"items": list,
		"total": total,
	})
}

func (s *WebhookLog) GetByID(ctx echo.Context) error {
	id := ctx.Param("id")
	c := ctx.Request().Context()
	log, err := s.repo.GetByID(c, id)
	if err != nil {
		if err == webhook_logs.ErrNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "webhook log not found")
		}
		zap.L().Error("webhook log get failed", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to get webhook log")
	}
	// Admin: only allow if log belongs to their company
	if role, _ := ctx.Get("user_role").(string); role != "super_admin" {
		if cid, ok := ctx.Get("company_id").(string); ok && cid != "" {
			if log.CompanyID == nil || *log.CompanyID != cid {
				return utils.HTTPFail(ctx, http.StatusForbidden, nil, "forbidden")
			}
		}
	}
	return ctx.JSON(http.StatusOK, log)
}
