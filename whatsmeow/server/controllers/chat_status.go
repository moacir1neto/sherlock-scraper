package controllers

import (
	"encoding/json"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/utils"
)

// ChatStatus controla mudança de setor e status (attend/finish) de um chat.
type ChatStatus struct {
	instanceRepo interfaces.InstanceRepository
	instanceUser  interfaces.InstanceUserRepository
	chatRepo     interfaces.ChatRepository
	auditRepo    interfaces.AuditLogRepository
}

func NewChatStatus(instanceRepo interfaces.InstanceRepository, instanceUser interfaces.InstanceUserRepository, chatRepo interfaces.ChatRepository, auditRepo interfaces.AuditLogRepository) *ChatStatus {
	return &ChatStatus{
		instanceRepo: instanceRepo,
		instanceUser: instanceUser,
		chatRepo:     chatRepo,
		auditRepo:    auditRepo,
	}
}

// ensureInstanceAccess reaproveita a lógica do ChatUI; user só acessa se estiver em instance_users.
func (s *ChatStatus) ensureInstanceAccess(c echo.Context, instanceID string) error {
	ctx := c.Request().Context()
	role, _ := c.Get("user_role").(string)
	companyID, _ := c.Get("company_id").(string)
	userID, _ := c.Get("user_id").(string)

	instances, err := s.instanceRepo.List(ctx, instanceID)
	if err != nil || len(instances) == 0 {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "instance not found")
	}
	inst := instances[0]
	if role == "super_admin" {
		return nil
	}
	if role == "user" {
		if s.instanceUser != nil {
			ids, _ := s.instanceUser.ListInstanceIDsByUserID(ctx, userID)
			for _, id := range ids {
				if id == instanceID {
					return nil
				}
			}
		}
		return utils.HTTPFail(c, http.StatusForbidden, nil, "access denied to this instance")
	}
	if role == "admin" && companyID != "" && inst.CompanyID != nil && *inst.CompanyID == companyID {
		return nil
	}
	return utils.HTTPFail(c, http.StatusForbidden, nil, "access denied to this instance")
}

type updateSectorRequest struct {
	SectorID *string `json:"sector_id"`
}

// UpdateSector altera o setor de um chat.
func (s *ChatStatus) UpdateSector(c echo.Context) error {
	instanceID := c.Param("id")
	chatID := c.Param("chatId")
	if instanceID == "" || chatID == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "instance id and chat id are required")
	}
	if err := s.ensureInstanceAccess(c, instanceID); err != nil {
		return err
	}
	chat, err := s.chatRepo.GetByID(c.Request().Context(), chatID)
	if err != nil || chat == nil || chat.InstanceID != instanceID {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "chat not found")
	}
	var body updateSectorRequest
	if err := c.Bind(&body); err != nil {
		return utils.HTTPFail(c, http.StatusUnprocessableEntity, err, "invalid body")
	}
	if err := s.chatRepo.UpdateStatusAndSector(c.Request().Context(), chatID, chat.Status, body.SectorID); err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to update chat sector")
	}
	if s.auditRepo != nil {
		userID, _ := c.Get("user_id").(string)
		userEmail, _ := c.Get("user_email").(string)
		oldVal, _ := json.Marshal(map[string]interface{}{
			"sector_id": chat.SectorID,
		})
		newVal, _ := json.Marshal(map[string]interface{}{
			"sector_id": body.SectorID,
		})
		_ = s.auditRepo.Create(c.Request().Context(), &models.AuditLog{
			UserID:     &userID,
			UserEmail:  userEmail,
			Action:     "update_chat_sector",
			EntityType: "chat",
			EntityID:   chatID,
			OldValue:   string(oldVal),
			NewValue:   string(newVal),
		})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

// Attend muda o status do chat para "atendendo".
func (s *ChatStatus) Attend(c echo.Context) error {
	instanceID := c.Param("id")
	chatID := c.Param("chatId")
	if instanceID == "" || chatID == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "instance id and chat id are required")
	}
	if err := s.ensureInstanceAccess(c, instanceID); err != nil {
		return err
	}
	chat, err := s.chatRepo.GetByID(c.Request().Context(), chatID)
	if err != nil || chat == nil || chat.InstanceID != instanceID {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "chat not found")
	}
	oldStatus := chat.Status
	if err := s.chatRepo.UpdateStatusAndSector(c.Request().Context(), chatID, "atendendo", chat.SectorID); err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to update chat status")
	}
	if s.auditRepo != nil {
		userID, _ := c.Get("user_id").(string)
		userEmail, _ := c.Get("user_email").(string)
		oldVal, _ := json.Marshal(map[string]interface{}{
			"status": oldStatus,
		})
		newVal, _ := json.Marshal(map[string]interface{}{
			"status": "atendendo",
		})
		_ = s.auditRepo.Create(c.Request().Context(), &models.AuditLog{
			UserID:     &userID,
			UserEmail:  userEmail,
			Action:     "chat_attend",
			EntityType: "chat",
			EntityID:   chatID,
			OldValue:   string(oldVal),
			NewValue:   string(newVal),
		})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "atendendo"})
}

// ResumeAgent zera ai_paused=false, retomando as respostas automáticas do Super Vendedor para este chat.
// PUT /v1/instance/:id/chats/:chatId/resume-agent
func (s *ChatStatus) ResumeAgent(c echo.Context) error {
	instanceID := c.Param("id")
	chatID := c.Param("chatId")
	if instanceID == "" || chatID == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "instance id and chat id are required")
	}
	if err := s.ensureInstanceAccess(c, instanceID); err != nil {
		return err
	}
	chat, err := s.chatRepo.GetByID(c.Request().Context(), chatID)
	if err != nil || chat == nil || chat.InstanceID != instanceID {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "chat not found")
	}
	if err := s.chatRepo.ResumeAgent(c.Request().Context(), chatID); err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to resume agent")
	}
	if s.auditRepo != nil {
		userID, _ := c.Get("user_id").(string)
		userEmail, _ := c.Get("user_email").(string)
		_ = s.auditRepo.Create(c.Request().Context(), &models.AuditLog{
			UserID:     &userID,
			UserEmail:  userEmail,
			Action:     "resume_agent",
			EntityType: "chat",
			EntityID:   chatID,
			OldValue:   `{"ai_paused":true}`,
			NewValue:   `{"ai_paused":false}`,
		})
	}
	return c.JSON(http.StatusOK, map[string]bool{"ai_paused": false})
}

// Finish muda o status do chat para "finalizado".
func (s *ChatStatus) Finish(c echo.Context) error {
	instanceID := c.Param("id")
	chatID := c.Param("chatId")
	if instanceID == "" || chatID == "" {
		return utils.HTTPFail(c, http.StatusBadRequest, nil, "instance id and chat id are required")
	}
	if err := s.ensureInstanceAccess(c, instanceID); err != nil {
		return err
	}
	chat, err := s.chatRepo.GetByID(c.Request().Context(), chatID)
	if err != nil || chat == nil || chat.InstanceID != instanceID {
		return utils.HTTPFail(c, http.StatusNotFound, nil, "chat not found")
	}
	oldStatus := chat.Status
	if err := s.chatRepo.UpdateStatusAndSector(c.Request().Context(), chatID, "finalizado", chat.SectorID); err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to update chat status")
	}
	if s.auditRepo != nil {
		userID, _ := c.Get("user_id").(string)
		userEmail, _ := c.Get("user_email").(string)
		oldVal, _ := json.Marshal(map[string]interface{}{
			"status": oldStatus,
		})
		newVal, _ := json.Marshal(map[string]interface{}{
			"status": "finalizado",
		})
		_ = s.auditRepo.Create(c.Request().Context(), &models.AuditLog{
			UserID:     &userID,
			UserEmail:  userEmail,
			Action:     "chat_finish",
			EntityType: "chat",
			EntityID:   chatID,
			OldValue:   string(oldVal),
			NewValue:   string(newVal),
		})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "finalizado"})
}

