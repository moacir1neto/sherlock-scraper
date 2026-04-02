package controllers

import (
	"net/http"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/repositories/quick_replies"
	"github.com/verbeux-ai/whatsmiau/server/dto"
	"github.com/verbeux-ai/whatsmiau/utils"
)

type QuickReply struct {
	repo interfaces.QuickReplyRepository
}

func NewQuickReply(repo interfaces.QuickReplyRepository) *QuickReply {
	return &QuickReply{repo: repo}
}

func (s *QuickReply) List(c echo.Context) error {
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
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to list quick replies")
	}
	return c.JSON(http.StatusOK, list)
}

func (s *QuickReply) Create(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}
	var req dto.CreateQuickReplyRequest
	if err := c.Bind(&req); err != nil {
		return utils.HTTPFail(c, http.StatusUnprocessableEntity, err, "invalid body")
	}
	if err := validator.New().Struct(&req); err != nil {
		return utils.HTTPFail(c, http.StatusBadRequest, err, "validation failed")
	}
	cmd := req.Command
	if len(cmd) > 0 && cmd[0] == '/' {
		cmd = cmd[1:]
	}
	q := &models.QuickReply{
		CompanyID: companyID,
		Command:   cmd,
		Message:   req.Message,
		CreatedAt: time.Now(),
	}
	if err := s.repo.Create(c.Request().Context(), q); err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to create quick reply")
	}
	return c.JSON(http.StatusCreated, q)
}

func (s *QuickReply) GetByID(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}
	id := c.Param("id")
	if id == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "id required")
	}
	q, err := s.repo.GetByID(c.Request().Context(), id, companyID)
	if err != nil {
		if err == quick_replies.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, err, "quick reply not found")
		}
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to get quick reply")
	}
	return c.JSON(http.StatusOK, q)
}

func (s *QuickReply) Update(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}
	id := c.Param("id")
	if id == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "id required")
	}
	var req dto.UpdateQuickReplyRequest
	if err := c.Bind(&req); err != nil {
		return utils.HTTPFail(c, http.StatusUnprocessableEntity, err, "invalid body")
	}
	req.ID = id
	if err := validator.New().Struct(&req); err != nil {
		return utils.HTTPFail(c, http.StatusBadRequest, err, "validation failed")
	}
	cmd := req.Command
	if len(cmd) > 0 && cmd[0] == '/' {
		cmd = cmd[1:]
	}
	q := &models.QuickReply{ID: id, CompanyID: companyID, Command: cmd, Message: req.Message}
	if err := s.repo.Update(c.Request().Context(), q); err != nil {
		if err == quick_replies.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, err, "quick reply not found")
		}
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to update quick reply")
	}
	return c.JSON(http.StatusOK, q)
}

func (s *QuickReply) Delete(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}
	id := c.Param("id")
	if id == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "id required")
	}
	if err := s.repo.Delete(c.Request().Context(), id, companyID); err != nil {
		if err == quick_replies.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, err, "quick reply not found")
		}
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to delete quick reply")
	}
	return c.NoContent(http.StatusNoContent)
}
