package controllers

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/utils"
)

// Dashboard retorna estatísticas para o painel.
type Dashboard struct {
	instanceRepo interfaces.InstanceRepository
	instanceUser interfaces.InstanceUserRepository
	messageRepo  interfaces.MessageRepository
	chatRepo     interfaces.ChatRepository
}

// NewDashboard cria o controller do dashboard.
func NewDashboard(instanceRepo interfaces.InstanceRepository, instanceUser interfaces.InstanceUserRepository, messageRepo interfaces.MessageRepository, chatRepo interfaces.ChatRepository) *Dashboard {
	return &Dashboard{
		instanceRepo: instanceRepo,
		instanceUser: instanceUser,
		messageRepo:  messageRepo,
		chatRepo:     chatRepo,
	}
}

// StatsResponse resposta do GET /admin/dashboard/stats
type StatsResponse struct {
	MessagesToday     int   `json:"messages_today"`
	MessagesLast7Days []int `json:"messages_last_7_days"` // [dia-6, ..., hoje]
	ChatsAguardando   int   `json:"chats_aguardando"`
	ChatsAtendendo    int   `json:"chats_atendendo"`
	ChatsFinalizado   int   `json:"chats_finalizado"`
}

// Stats GET /admin/dashboard/stats — mensagens enviadas hoje e contagem por dia nos últimos 7 dias.
func (s *Dashboard) Stats(c echo.Context) error {
	ctx := c.Request().Context()
	role, _ := c.Get("user_role").(string)
	companyID, _ := c.Get("company_id").(string)
	userID, _ := c.Get("user_id").(string)

	// Listar instâncias conforme o role (mesma lógica do Instance.List)
	all, err := s.instanceRepo.List(ctx, "")
	if err != nil {
		return utils.HTTPFail(c, http.StatusInternalServerError, err, "failed to list instances")
	}
	var instanceIDs []string
	if role == "super_admin" {
		for _, inst := range all {
			instanceIDs = append(instanceIDs, inst.ID)
		}
	} else if role == "user" && s.instanceUser != nil {
		instanceIDs, _ = s.instanceUser.ListInstanceIDsByUserID(ctx, userID)
	} else if role == "admin" {
		for _, inst := range all {
			if companyID != "" && inst.CompanyID != nil && *inst.CompanyID == companyID {
				instanceIDs = append(instanceIDs, inst.ID)
			}
		}
	}

	if len(instanceIDs) == 0 {
		return c.JSON(http.StatusOK, StatsResponse{
			MessagesToday:     0,
			MessagesLast7Days: []int{0, 0, 0, 0, 0, 0, 0},
			ChatsAguardando:   0,
			ChatsAtendendo:    0,
			ChatsFinalizado:   0,
		})
	}

	loc := time.Now().Location()
	now := time.Now().In(loc)
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	todayEnd := todayStart.Add(24 * time.Hour)

	messagesToday, _ := s.messageRepo.CountSentByInstanceIDsBetween(ctx, instanceIDs, todayStart, todayEnd)

	// Últimos 7 dias: do mais antigo ao mais recente (índice 0 = 6 dias atrás, 6 = hoje)
	messagesLast7Days := make([]int, 7)
	for i := 0; i < 7; i++ {
		dayStart := todayStart.AddDate(0, 0, -6+i)
		dayEnd := dayStart.Add(24 * time.Hour)
		n, _ := s.messageRepo.CountSentByInstanceIDsBetween(ctx, instanceIDs, dayStart, dayEnd)
		messagesLast7Days[i] = n
	}

	chatsAguardando, chatsAtendendo, chatsFinalizado := 0, 0, 0
	if s.chatRepo != nil {
		chatsAguardando, chatsAtendendo, chatsFinalizado, _ = s.chatRepo.CountByInstanceIDsGroupByStatus(ctx, instanceIDs)
	}

	return c.JSON(http.StatusOK, StatsResponse{
		MessagesToday:     messagesToday,
		MessagesLast7Days: messagesLast7Days,
		ChatsAguardando:   chatsAguardando,
		ChatsAtendendo:    chatsAtendendo,
		ChatsFinalizado:   chatsFinalizado,
	})
}
