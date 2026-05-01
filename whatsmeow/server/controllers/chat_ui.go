package controllers

import (
	"errors"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/lib/whatsmiau"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

// ChatUI serves the chat list and messages API for the WhatsApp Web-style UI.
type ChatUI struct {
	instanceRepo interfaces.InstanceRepository
	instanceUser interfaces.InstanceUserRepository
	sectorUser   interfaces.SectorUserRepository
	chatRepo     interfaces.ChatRepository
	messageRepo  interfaces.MessageRepository
	whatsmiau    *whatsmiau.Whatsmiau
}

// NewChatUI creates a ChatUI controller.
func NewChatUI(instanceRepo interfaces.InstanceRepository, instanceUser interfaces.InstanceUserRepository, sectorUser interfaces.SectorUserRepository, chatRepo interfaces.ChatRepository, messageRepo interfaces.MessageRepository, miau *whatsmiau.Whatsmiau) *ChatUI {
	return &ChatUI{
		instanceRepo: instanceRepo,
		instanceUser: instanceUser,
		sectorUser:   sectorUser,
		chatRepo:     chatRepo,
		messageRepo:  messageRepo,
		whatsmiau:    miau,
	}
}

// ensureInstanceAccess returns the instance if the user has access (same logic as instance List). Returns nil if no access.
func (s *ChatUI) ensureInstanceAccess(c echo.Context, instanceID string) *models.Instance {
	ctx := c.Request().Context()
	role, _ := c.Get("user_role").(string)
	companyID, _ := c.Get("company_id").(string)
	userID, _ := c.Get("user_id").(string)

	instances, err := s.instanceRepo.List(ctx, instanceID)
	if err != nil || len(instances) == 0 {
		return nil
	}
	inst := &instances[0]
	if role == "super_admin" {
		return inst
	}
	if role == "user" {
		// User: só acessa se estiver em instance_users para esta instância
		if s.instanceUser != nil {
			ids, _ := s.instanceUser.ListInstanceIDsByUserID(ctx, userID)
			for _, id := range ids {
				if id == instanceID {
					return inst
				}
			}
		}
		return nil
	}
	if role == "admin" {
		if companyID != "" && inst.CompanyID != nil && *inst.CompanyID == companyID {
			return inst
		}
	}
	return nil
}

// ListChats returns chats for an instance. GET /v1/instance/:id/chats?limit=50
func (s *ChatUI) ListChats(c echo.Context) error {
	instanceID := c.Param("id")
	if instanceID == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "instance id is required")
	}
	if s.ensureInstanceAccess(c, instanceID) == nil {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "instance not found")
	}

	limit := 50
	if l := c.QueryParam("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			if n > 100 {
				n = 100
			}
			limit = n
		}
	}

	ctx := c.Request().Context()
	var allowedSectorIDs []string
	role, _ := c.Get("user_role").(string)
	userID, _ := c.Get("user_id").(string)
	if role == "user" && s.sectorUser != nil {
		allowedSectorIDs, _ = s.sectorUser.ListSectorIDsByUserID(ctx, userID)
		// User não vê setor Geral; allowedSectorIDs já não inclui Geral (admin não atribui user ao Geral)
	}
	chats, err := s.chatRepo.ListByInstanceID(ctx, instanceID, limit, allowedSectorIDs)
	if err != nil {
		zap.L().Error("list chats failed", zap.Error(err), zap.String("instance", instanceID))
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to list chats")
	}
	return c.JSON(http.StatusOK, chats)
}

// ListMessages returns messages for a chat with cursor pagination. GET /v1/instance/:id/chats/:chatId/messages?limit=50&before_id=xxx
func (s *ChatUI) ListMessages(c echo.Context) error {
	instanceID := c.Param("id")
	chatID := c.Param("chatId")
	if instanceID == "" || chatID == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "instance id and chat id are required")
	}
	if s.ensureInstanceAccess(c, instanceID) == nil {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "instance not found")
	}

	chat, err := s.chatRepo.GetByID(c.Request().Context(), chatID)
	if err != nil || chat == nil {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "chat not found")
	}
	if chat.InstanceID != instanceID {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "chat does not belong to this instance")
	}

	limit := 50
	if l := c.QueryParam("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			if n > 100 {
				n = 100
			}
			limit = n
		}
	}
	beforeID := c.QueryParam("before_id")

	ctx := c.Request().Context()
	messages, err := s.messageRepo.ListByChatID(ctx, chatID, limit, beforeID)
	if err != nil {
		zap.L().Error("list messages failed", zap.Error(err), zap.String("chat", chatID))
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to list messages")
	}
	return c.JSON(http.StatusOK, messages)
}

// ProfilePicture returns the profile picture image for a contact/group. GET /v1/instance/:id/profile-picture?jid=5511999999999
// jid can be the full JID (5511999999999@s.whatsapp.net) or just the number (5511999999999). For groups use 123@g.us.
func (s *ChatUI) ProfilePicture(c echo.Context) error {
	instanceID := c.Param("id")
	jid := c.QueryParam("jid")
	if instanceID == "" || jid == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "instance id and jid are required")
	}
	if s.ensureInstanceAccess(c, instanceID) == nil {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "instance not found")
	}
	if s.whatsmiau == nil {
		return utils.HTTPFail(c, http.StatusServiceUnavailable, nil, "service unavailable")
	}
	img, contentType, err := s.whatsmiau.GetProfilePictureBytes(instanceID, jid)
	if err != nil || len(img) == 0 {
		return c.NoContent(http.StatusNotFound)
	}
	c.Response().Header().Set("Cache-Control", "private, max-age=3600")
	return c.Blob(http.StatusOK, contentType, img)
}

// GetMessageMedia serves media file for a message when media_url is "local:...". GET /v1/instance/:id/chats/:chatId/messages/:messageId/media
func (s *ChatUI) GetMessageMedia(c echo.Context) error {
	instanceID := c.Param("id")
	chatID := c.Param("chatId")
	messageID := c.Param("messageId")
	if instanceID == "" || chatID == "" || messageID == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "instance id, chat id and message id are required")
	}
	if s.ensureInstanceAccess(c, instanceID) == nil {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "instance not found")
	}
	ctx := c.Request().Context()
	msg, err := s.messageRepo.GetByID(ctx, messageID)
	if err != nil || msg == nil {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "message not found")
	}
	if msg.ChatID != chatID {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "message does not belong to this chat")
	}
	chat, err := s.chatRepo.GetByID(ctx, chatID)
	if err != nil || chat == nil || chat.InstanceID != instanceID {
		return utils.HTTPFail(c, http.StatusForbidden, nil, "chat does not belong to this instance")
	}
	if msg.MediaURL == "" || !strings.HasPrefix(msg.MediaURL, "local:") {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "no local media for this message")
	}
	relPath := strings.TrimPrefix(msg.MediaURL, "local:")
	// relPath is instanceID/safeJid/waMessageID.ext (forward slashes)
	fullPath := filepath.Join("data", "media", filepath.FromSlash(relPath))
	data, err := readFileSafe(fullPath)
	if err != nil {
		zap.L().Error("failed to read message media", zap.String("path", fullPath), zap.Error(err))
		return utils.HTTPFail(c, http.StatusNotFound, nil, "media file not found")
	}
	ext := filepath.Ext(fullPath)
	contentType := mime.TypeByExtension(ext)
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	c.Response().Header().Set("Cache-Control", "private, max-age=86400")
	return c.Blob(http.StatusOK, contentType, data)
}

// readFileSafe reads the file at path only if it is under "data/media" (no path traversal).
func readFileSafe(fullPath string) ([]byte, error) {
	base, err := filepath.Abs("data/media")
	if err != nil {
		return nil, err
	}
	abs, err := filepath.Abs(fullPath)
	if err != nil {
		return nil, err
	}
	if !strings.HasPrefix(abs, base+string(filepath.Separator)) && abs != base {
		return nil, errors.New("invalid path")
	}
	return os.ReadFile(fullPath)
}
