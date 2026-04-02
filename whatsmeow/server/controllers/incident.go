package controllers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/repositories/incidents"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

type Incident struct {
	repo interfaces.IncidentRepository
}

func NewIncident(repo interfaces.IncidentRepository) *Incident {
	return &Incident{repo: repo}
}

func (s *Incident) List(ctx echo.Context) error {
	limit, _ := strconv.Atoi(ctx.QueryParam("limit"))
	offset, _ := strconv.Atoi(ctx.QueryParam("offset"))
	code := ctx.QueryParam("code")
	tenantID := ctx.QueryParam("tenant_id")

	c := ctx.Request().Context()
	list, total, err := s.repo.List(c, limit, offset, code, tenantID)
	if err != nil {
		zap.L().Error("incident list failed", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to list incidents")
	}
	return ctx.JSON(http.StatusOK, map[string]interface{}{
		"items":  list,
		"total":  total,
	})
}

func (s *Incident) GetByID(ctx echo.Context) error {
	id := ctx.Param("id")
	c := ctx.Request().Context()
	inc, err := s.repo.GetByID(c, id)
	if err != nil {
		if err == incidents.ErrNotFound {
			return utils.HTTPFail(ctx, http.StatusNotFound, err, "incident not found")
		}
		zap.L().Error("incident get failed", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to get incident")
	}
	return ctx.JSON(http.StatusOK, inc)
}
