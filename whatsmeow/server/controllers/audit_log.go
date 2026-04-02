package controllers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/repositories/audit_logs"
	"github.com/verbeux-ai/whatsmiau/utils"
)

type AuditLog struct {
	repo interfaces.AuditLogRepository
}

func NewAuditLog(repo interfaces.AuditLogRepository) *AuditLog {
	return &AuditLog{repo: repo}
}

func (s *AuditLog) List(c echo.Context) error {
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	offset, _ := strconv.Atoi(c.QueryParam("offset"))
	companyID := c.QueryParam("company_id")
	if companyID == "" {
		if cid, ok := c.Get("company_id").(string); ok && cid != "" {
			companyID = cid
		}
	} else {
		if role, _ := c.Get("user_role").(string); role != "super_admin" {
			companyID = ""
			if cid, ok := c.Get("company_id").(string); ok && cid != "" {
				companyID = cid
			}
		}
	}
	list, total, err := s.repo.List(c.Request().Context(), companyID, limit, offset)
	if err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to list audit logs")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"items": list, "total": total})
}

func (s *AuditLog) GetByID(c echo.Context) error {
	id := c.Param("id")
	log, err := s.repo.GetByID(c.Request().Context(), id)
	if err != nil {
		if err == audit_logs.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, err, "audit log not found")
		}
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to get audit log")
	}
	if role, _ := c.Get("user_role").(string); role != "super_admin" {
		if cid, ok := c.Get("company_id").(string); ok && cid != "" {
			if log.CompanyID == nil || *log.CompanyID != cid {
				return utils.HTTPFail(c, http.StatusForbidden, nil, "forbidden")
			}
		}
	}
	return c.JSON(http.StatusOK, log)
}
