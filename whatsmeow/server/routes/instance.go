package routes

import (
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/lib/whatsmiau"
	"github.com/verbeux-ai/whatsmiau/repositories/audit_logs"
	"github.com/verbeux-ai/whatsmiau/repositories/chats"
	"github.com/verbeux-ai/whatsmiau/repositories/chattags"
	"github.com/verbeux-ai/whatsmiau/repositories/instance_users"
	"github.com/verbeux-ai/whatsmiau/repositories/instances"
	"github.com/verbeux-ai/whatsmiau/repositories/messages"
	"github.com/verbeux-ai/whatsmiau/repositories/sector_users"
	"github.com/verbeux-ai/whatsmiau/repositories/tags"
	"github.com/verbeux-ai/whatsmiau/repositories/webhook_logs"
	"github.com/verbeux-ai/whatsmiau/server/controllers"
	"github.com/verbeux-ai/whatsmiau/server/middleware"
	"github.com/verbeux-ai/whatsmiau/services"
	"go.uber.org/zap"
)

func Instance(group *echo.Group) {
	redisInstance := instances.NewRedis(services.Redis())
	var instanceUserRepo interfaces.InstanceUserRepository
	if iu, err := instance_users.NewSQL(); err == nil {
		instanceUserRepo = iu
	}
	var sectorUserRepo interfaces.SectorUserRepository
	if su, err := sector_users.NewSQL(); err == nil {
		sectorUserRepo = su
	}
	controller := controllers.NewInstances(redisInstance, instanceUserRepo, whatsmiau.Get())

	// Apply JWT middleware to all instance routes
	protected := group.Group("", middleware.JWTAuth)

	protected.POST("", controller.Create)
	protected.GET("", controller.List)
	protected.POST("/:id/connect", controller.Connect)
	protected.POST("/:id/logout", controller.Logout)
	protected.DELETE("/:id", controller.Delete)
	protected.GET("/:id/status", controller.Status)
	protected.GET("/:id/users", controller.ListInstanceUsers)
	protected.PUT("/:id/users", controller.SetInstanceUsers)

	// Chat UI (list chats and messages for WhatsApp Web-style panel)
	chatRepo, errChat := chats.NewSQL()
	messageRepo, errMsg := messages.NewSQL()
	if errChat != nil || errMsg != nil {
		zap.L().Warn("chat UI routes disabled: database or repos unavailable",
			zap.Error(errChat), zap.Error(errMsg))
	} else {
		var auditRepo interfaces.AuditLogRepository
		if ar, err := audit_logs.NewSQL(); err == nil {
			auditRepo = ar
		}
		chatUICtrl := controllers.NewChatUI(redisInstance, instanceUserRepo, sectorUserRepo, chatRepo, messageRepo, whatsmiau.Get())
		protected.GET("/:id/chats", chatUICtrl.ListChats)
		protected.GET("/:id/chats/:chatId/messages", chatUICtrl.ListMessages)
		protected.GET("/:id/chats/:chatId/messages/:messageId/media", chatUICtrl.GetMessageMedia)
		protected.GET("/:id/profile-picture", chatUICtrl.ProfilePicture)

		// Status e setor do chat (attend/finish/transfer sector)
		chatStatusCtrl := controllers.NewChatStatus(redisInstance, instanceUserRepo, chatRepo, auditRepo)
		protected.PUT("/:id/chats/:chatId/sector", chatStatusCtrl.UpdateSector)
		protected.POST("/:id/chats/:chatId/attend", chatStatusCtrl.Attend)
		protected.POST("/:id/chats/:chatId/finish", chatStatusCtrl.Finish)
		protected.PUT("/:id/chats/:chatId/resume-agent", chatStatusCtrl.ResumeAgent)
		protected.PUT("/:id/chats/:chatId/pause-agent", chatStatusCtrl.PauseAgent)

		// Tags do chat (por conversa)
		if tagRepo, errTag := tags.NewSQL(); errTag == nil {
			if chatTagRepo, errCT := chattags.NewSQL(); errCT == nil {
				tagCtrl := controllers.NewTag(tagRepo, chatTagRepo, chatRepo)
				protected.GET("/:id/chats/:chatId/tags", tagCtrl.ListByChat)
				protected.POST("/:id/chats/:chatId/tags", tagCtrl.AddToChat)
				protected.DELETE("/:id/chats/:chatId/tags/:tagId", tagCtrl.RemoveFromChat)
			}
		}
	}

	// Rotas de mensagem (text, reaction, revoke, edit) em /instance/:id/message/* (evita 404 por conflito de rotas)
	msgCtrl := controllers.NewMessages(redisInstance, whatsmiau.Get())
	msgGroup := protected.Group("/:id/message")
	msgGroup.POST("/text", msgCtrl.SendText)
	msgGroup.POST("/audio", msgCtrl.SendAudio)
	msgGroup.POST("/document", msgCtrl.SendDocument)
	msgGroup.POST("/image", msgCtrl.SendImage)
	msgGroup.POST("/reaction", msgCtrl.SendReaction)
	msgGroup.POST("/revoke", msgCtrl.RevokeMessage)
	msgGroup.POST("/edit", msgCtrl.EditMessage)

	// Webhook inbox (receive test POSTs) and send-test (dispatch test event to configured URL)
	if webhookLogRepo, errWL := webhook_logs.NewSQL(); errWL == nil {
		webhookInstanceCtrl := controllers.NewWebhookInstance(redisInstance, webhookLogRepo, whatsmiau.Get())
		protected.POST("/:id/webhook-inbox", webhookInstanceCtrl.WebhookInbox)
		protected.POST("/:id/webhook-send-test", webhookInstanceCtrl.WebhookSendTest)
	}

	// Evolution API Compatibility (partially REST)
	protected.POST("/create", controller.Create)
	protected.GET("/fetchInstances", controller.List)
	protected.GET("/connect/:id", controller.Connect)
	protected.GET("/connect/:id/image", controller.ConnectQRBuffer)
	protected.GET("/connectionState/:id", controller.Status)
	protected.DELETE("/logout/:id", controller.Logout)
	protected.DELETE("/delete/:id", controller.Delete)
	protected.PUT("/update/:id", controller.Update)
}
