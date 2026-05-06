package controllers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/utils"
)

// Kanban returns columns (tags with kanban_enabled) and chats per tag for the Kanban board.
type Kanban struct {
	tagRepo      interfaces.TagRepository
	chatTagRepo  interfaces.ChatTagRepository
	chatRepo     interfaces.ChatRepository
	instanceRepo interfaces.InstanceRepository
	instanceUser interfaces.InstanceUserRepository
	sectorUser   interfaces.SectorUserRepository
}

// NewKanban creates a Kanban controller.
func NewKanban(
	tagRepo interfaces.TagRepository,
	chatTagRepo interfaces.ChatTagRepository,
	chatRepo interfaces.ChatRepository,
	instanceRepo interfaces.InstanceRepository,
	instanceUser interfaces.InstanceUserRepository,
	sectorUser interfaces.SectorUserRepository,
) *Kanban {
	return &Kanban{
		tagRepo:      tagRepo,
		chatTagRepo:  chatTagRepo,
		chatRepo:     chatRepo,
		instanceRepo: instanceRepo,
		instanceUser: instanceUser,
		sectorUser:   sectorUser,
	}
}

// KanbanColumn is one column (tag) with its chats.
type KanbanColumn struct {
	Tag   models.Tag    `json:"tag"`
	Chats []models.Chat `json:"chats"`
}

// Get returns kanban columns: tags with kanban_enabled (ordered by sort_order), each with chats that have that tag.
// GET /admin/kanban?instance_id=xxx
func (s *Kanban) Get(c echo.Context) error {
	instanceID := c.QueryParam("instance_id")
	if instanceID == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "instance_id is required")
	}
	ctx := c.Request().Context()
	role, _ := c.Get("user_role").(string)
	companyID, _ := c.Get("company_id").(string)
	userID, _ := c.Get("user_id").(string)

	// Check instance access (same logic as ChatUI)
	instances, err := s.instanceRepo.List(ctx, instanceID)
	if err != nil || len(instances) == 0 {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "instance not found")
	}
	inst := &instances[0]
	if role == "super_admin" {
		// ok
	} else if role == "user" {
		if s.instanceUser != nil {
			ids, _ := s.instanceUser.ListInstanceIDsByUserID(ctx, userID)
			found := false
			for _, id := range ids {
				if id == instanceID {
					found = true
					break
				}
			}
			if !found {
				return utils.HTTPFail(c, http.StatusForbidden, nil, "access denied to this instance")
			}
		} else {
			return utils.HTTPFail(c, http.StatusForbidden, nil, "access denied")
		}
	} else if role == "admin" {
		if companyID == "" || inst.CompanyID == nil || *inst.CompanyID != companyID {
			return utils.HTTPFail(c, http.StatusForbidden, nil, "access denied to this instance")
		}
	} else {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "access denied")
	}

	if inst.CompanyID == nil || *inst.CompanyID == "" {
		return c.JSON(http.StatusOK, []KanbanColumn{})
	}
	companyID = *inst.CompanyID

	// Tags with kanban_enabled, ordered by sort_order
	allTags, err := s.tagRepo.ListByCompanyID(ctx, companyID)
	if err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to list tags")
	}
	var kanbanTags []models.Tag
	for _, t := range allTags {
		if t.KanbanEnabled {
			kanbanTags = append(kanbanTags, t)
		}
	}

	// Chats for this instance (with sector filter for user)
	var allowedSectorIDs []string
	if role == "user" && s.sectorUser != nil {
		allowedSectorIDs, _ = s.sectorUser.ListSectorIDsByUserID(ctx, userID)
	}
	chats, err := s.chatRepo.ListByInstanceID(ctx, instanceID, 500, allowedSectorIDs)
	if err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to list chats")
	}
	chatMap := make(map[string]*models.Chat)
	for i := range chats {
		chatMap[chats[i].ID] = &chats[i]
	}

	// Build columns: for each kanban tag, chats that have this tag
	out := make([]KanbanColumn, 0, len(kanbanTags))
	for _, tag := range kanbanTags {
		chatIDs, _ := s.chatTagRepo.ListChatIDsByTagID(ctx, tag.ID)
		columnChats := make([]models.Chat, 0, len(chatIDs))
		for _, id := range chatIDs {
			if ch, ok := chatMap[id]; ok {
				columnChats = append(columnChats, *ch)
			}
		}
		out = append(out, KanbanColumn{Tag: tag, Chats: columnChats})
	}
	return c.JSON(http.StatusOK, out)
}
