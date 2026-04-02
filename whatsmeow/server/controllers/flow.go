package controllers

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/repositories/flows"
	"github.com/verbeux-ai/whatsmiau/server/dto"
	"github.com/verbeux-ai/whatsmiau/utils"
)

type Flow struct {
	repo interfaces.FlowRepository
}

func NewFlow(repo interfaces.FlowRepository) *Flow {
	return &Flow{repo: repo}
}

func normalizeFlowCommand(cmd string) string {
	trimmed := strings.TrimSpace(cmd)
	if trimmed == "" {
		return ""
	}
	// remove barra invertida inicial, se houver, e converte para minúsculas
	if strings.HasPrefix(trimmed, "\\") {
		trimmed = trimmed[1:]
	}
	return strings.ToLower(trimmed)
}

func (s *Flow) List(c echo.Context) error {
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
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to list flows")
	}
	return c.JSON(http.StatusOK, list)
}

func (s *Flow) Create(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}
	var req dto.CreateFlowRequest
	if err := c.Bind(&req); err != nil {
		return utils.HTTPFail(c, http.StatusUnprocessableEntity, err, "invalid body")
	}
	if err := validator.New().Struct(&req); err != nil {
		return utils.HTTPFail(c, http.StatusBadRequest, err, "validation failed")
	}
	cmd := normalizeFlowCommand(req.Command)
	if cmd == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "command is required")
	}
	def := req.Definition
	if def == nil {
		def = []byte("{}")
	}
	f := &models.Flow{
		CompanyID:  companyID,
		Name:       req.Name,
		Command:    cmd,
		Definition: def,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	if err := s.repo.Create(c.Request().Context(), f); err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to create flow")
	}
	return c.JSON(http.StatusCreated, f)
}

func (s *Flow) GetByID(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}
	id := c.Param("id")
	if id == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "id required")
	}
	f, err := s.repo.GetByID(c.Request().Context(), id, companyID)
	if err != nil {
		if err == flows.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, err, "flow not found")
		}
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to get flow")
	}
	return c.JSON(http.StatusOK, f)
}

func (s *Flow) Update(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}
	id := c.Param("id")
	if id == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "id required")
	}
	var req dto.UpdateFlowRequest
	if err := c.Bind(&req); err != nil {
		return utils.HTTPFail(c, http.StatusUnprocessableEntity, err, "invalid body")
	}
	req.ID = id
	if err := validator.New().Struct(&req); err != nil {
		return utils.HTTPFail(c, http.StatusBadRequest, err, "validation failed")
	}
	cmd := normalizeFlowCommand(req.Command)
	if cmd == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "command is required")
	}
	def := req.Definition
	if def == nil {
		def = []byte("{}")
	}
	f := &models.Flow{ID: id, CompanyID: companyID, Name: req.Name, Command: cmd, Definition: def}
	if err := s.repo.Update(c.Request().Context(), f); err != nil {
		if err == flows.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, err, "flow not found")
		}
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to update flow")
	}
	return c.JSON(http.StatusOK, f)
}

func (s *Flow) Delete(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}
	id := c.Param("id")
	if id == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "id required")
	}
	if err := s.repo.Delete(c.Request().Context(), id, companyID); err != nil {
		if err == flows.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, err, "flow not found")
		}
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to delete flow")
	}
	return c.NoContent(http.StatusNoContent)
}
