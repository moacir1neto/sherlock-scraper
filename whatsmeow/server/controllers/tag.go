package controllers

import (
	"net/http"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/repositories/tags"
	"github.com/verbeux-ai/whatsmiau/server/dto"
	"github.com/verbeux-ai/whatsmiau/utils"
)

type Tag struct {
	repo        interfaces.TagRepository
	chatTagRepo interfaces.ChatTagRepository
	chatRepo    interfaces.ChatRepository
}

func NewTag(repo interfaces.TagRepository, chatTagRepo interfaces.ChatTagRepository, chatRepo interfaces.ChatRepository) *Tag {
	return &Tag{repo: repo, chatTagRepo: chatTagRepo, chatRepo: chatRepo}
}

func (s *Tag) List(c echo.Context) error {
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
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to list tags")
	}
	// Enrich with usage count
	type item struct {
		models.Tag
		UsageCount int `json:"usage_count"`
	}
	out := make([]item, 0, len(list))
	for _, t := range list {
		count, _ := s.repo.CountUsage(c.Request().Context(), t.ID, companyID)
		out = append(out, item{Tag: t, UsageCount: count})
	}
	return c.JSON(http.StatusOK, out)
}

func (s *Tag) Create(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}
	var req dto.CreateTagRequest
	if err := c.Bind(&req); err != nil {
		return utils.HTTPFail(c, http.StatusUnprocessableEntity, err, "invalid body")
	}
	if err := validator.New().Struct(&req); err != nil {
		return utils.HTTPFail(c, http.StatusBadRequest, err, "validation failed")
	}
	kanban := false
	if req.KanbanEnabled != nil {
		kanban = *req.KanbanEnabled
	}
	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}
	tag := &models.Tag{
		CompanyID:     companyID,
		Name:          req.Name,
		Color:         req.Color,
		KanbanEnabled: kanban,
		SortOrder:     sortOrder,
		CreatedAt:     time.Now(),
	}
	if err := s.repo.Create(c.Request().Context(), tag); err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to create tag")
	}
	return c.JSON(http.StatusCreated, tag)
}

func (s *Tag) GetByID(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}
	id := c.Param("id")
	tag, err := s.repo.GetByID(c.Request().Context(), id, companyID)
	if err != nil {
		if err == tags.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, err, "tag not found")
		}
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to get tag")
	}
	return c.JSON(http.StatusOK, tag)
}

func (s *Tag) Update(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}
	id := c.Param("id")
	var req dto.UpdateTagRequest
	if err := c.Bind(&req); err != nil {
		return utils.HTTPFail(c, http.StatusUnprocessableEntity, err, "invalid body")
	}
	req.ID = id
	if err := validator.New().Struct(&req); err != nil {
		return utils.HTTPFail(c, http.StatusBadRequest, err, "validation failed")
	}
	kanban := false
	if req.KanbanEnabled != nil {
		kanban = *req.KanbanEnabled
	}
	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}
	tag := &models.Tag{ID: id, CompanyID: companyID, Name: req.Name, Color: req.Color, KanbanEnabled: kanban, SortOrder: sortOrder}
	if err := s.repo.Update(c.Request().Context(), tag); err != nil {
		if err == tags.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, err, "tag not found")
		}
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to update tag")
	}
	return c.JSON(http.StatusOK, tag)
}

func (s *Tag) Delete(c echo.Context) error {
	companyID, _ := c.Get("company_id").(string)
	if companyID == "" {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "company_id required")
	}
	id := c.Param("id")
	if err := s.repo.Delete(c.Request().Context(), id, companyID); err != nil {
		if err == tags.ErrNotFound {
			return utils.HTTPFail(c, http.StatusNotFound, err, "tag not found")
		}
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to delete tag")
	}
	return c.NoContent(http.StatusNoContent)
}

func (s *Tag) ListByChat(c echo.Context) error {
	instanceID := c.Param("id")
	chatID := c.Param("chatId")
	if instanceID == "" || chatID == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "instance id and chat id required")
	}
	chat, err := s.chatRepo.GetByID(c.Request().Context(), chatID)
	if err != nil || chat == nil || chat.InstanceID != instanceID {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "chat not found")
	}
	list, err := s.chatTagRepo.ListByChatID(c.Request().Context(), chatID)
	if err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to list tags for chat")
	}
	return c.JSON(http.StatusOK, list)
}

func (s *Tag) AddToChat(c echo.Context) error {
	instanceID := c.Param("id")
	chatID := c.Param("chatId")
	if instanceID == "" || chatID == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "instance id and chat id required")
	}
	chat, err := s.chatRepo.GetByID(c.Request().Context(), chatID)
	if err != nil || chat == nil || chat.InstanceID != instanceID {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "chat not found")
	}
	var req dto.AddChatTagRequest
	if err := c.Bind(&req); err != nil {
		return utils.HTTPFail(c, http.StatusUnprocessableEntity, err, "invalid body")
	}
	if err := s.chatTagRepo.Add(c.Request().Context(), chatID, req.TagID); err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to add tag to chat")
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Tag) RemoveFromChat(c echo.Context) error {
	instanceID := c.Param("id")
	chatID := c.Param("chatId")
	tagID := c.Param("tagId")
	if instanceID == "" || chatID == "" || tagID == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "instance id, chat id and tag id required")
	}
	chat, err := s.chatRepo.GetByID(c.Request().Context(), chatID)
	if err != nil || chat == nil || chat.InstanceID != instanceID {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "chat not found")
	}
	if err := s.chatTagRepo.Remove(c.Request().Context(), chatID, tagID); err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to remove tag from chat")
	}
	return c.NoContent(http.StatusNoContent)
}
