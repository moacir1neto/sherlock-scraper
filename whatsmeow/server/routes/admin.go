package routes

import (
	"context"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/env"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/lib/whatsmiau"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/repositories/audit_logs"
	"github.com/verbeux-ai/whatsmiau/repositories/chats"
	"github.com/verbeux-ai/whatsmiau/repositories/chattags"
	"github.com/verbeux-ai/whatsmiau/repositories/companies"
	"github.com/verbeux-ai/whatsmiau/repositories/flows"
	"github.com/verbeux-ai/whatsmiau/repositories/instance_users"
	"github.com/verbeux-ai/whatsmiau/repositories/instances"
	"github.com/verbeux-ai/whatsmiau/repositories/messages"
	"github.com/verbeux-ai/whatsmiau/repositories/quick_replies"
	"github.com/verbeux-ai/whatsmiau/repositories/scheduled_messages"
	"github.com/verbeux-ai/whatsmiau/repositories/sector_users"
	"github.com/verbeux-ai/whatsmiau/repositories/sectors"
	"github.com/verbeux-ai/whatsmiau/repositories/tags"
	"github.com/verbeux-ai/whatsmiau/repositories/users"
	"github.com/verbeux-ai/whatsmiau/repositories/webhook_logs"
	"github.com/verbeux-ai/whatsmiau/server/controllers"
	"github.com/verbeux-ai/whatsmiau/server/middleware"
	"github.com/verbeux-ai/whatsmiau/services"
	"go.uber.org/zap"
)

func Admin(group *echo.Group) {
	sqlUserRepo, _ := users.NewSQL()
	sqlCompanyRepo, _ := companies.NewSQL()

	// Em modo desenvolvimento, usar apenas SQL (sem cache)
	var companyRepo interfaces.CompanyRepository = sqlCompanyRepo
	if !env.Env.DebugMode {
		companyRepo = companies.NewRedis(sqlCompanyRepo, services.Redis())
	}

	userController := controllers.NewUser(sqlUserRepo)
	companyController := controllers.NewCompany(companyRepo)

	// Apply JWT and admin middleware (super_admin or admin)
	protected := group.Group("", middleware.JWTAuth, middleware.AdminOnly)
	protected.POST("/upload", controllers.UploadFile)
	protected.GET("/users", userController.ListByCompany)

	// Admin can create users for their company
	protected.POST("/users", userController.CreateForCompany)

	// Admin can get, update, delete users from their company
	protected.GET("/users/:id", userController.GetByIDFromCompany)
	protected.PUT("/users/:id", userController.UpdateFromCompany)
	protected.DELETE("/users/:id", userController.DeleteFromCompany)

	// Admin can get and update their company profile
	protected.GET("/company", companyController.GetByCompanyID)
	protected.PUT("/company", companyController.UpdateByCompanyID)

	// Sectors (somente admin/super_admin, por empresa)
	var auditRepo interfaces.AuditLogRepository
	if ar, err := audit_logs.NewSQL(); err == nil {
		auditRepo = ar
	}

	var sectorUserRepo interfaces.SectorUserRepository
	if su, err := sector_users.NewSQL(); err == nil {
		sectorUserRepo = su
	}
	if sectorRepo, errSector := sectors.NewSQL(); errSector == nil {
		sectorCtrl := controllers.NewSector(sectorRepo, sectorUserRepo, auditRepo)
		protected.GET("/sectors", sectorCtrl.List)
		protected.POST("/sectors", sectorCtrl.Create)
		protected.GET("/sectors/:id", sectorCtrl.GetByID)
		protected.PUT("/sectors/:id", sectorCtrl.Update)
		protected.DELETE("/sectors/:id", sectorCtrl.Delete)
	}

	// Webhook logs (admin: own company; super_admin: all or filter by company_id)
	webhookLogRepo, errWL := webhook_logs.NewSQL()
	if errWL == nil {
		webhookLogCtrl := controllers.NewWebhookLog(webhookLogRepo)
		protected.GET("/webhook-logs", webhookLogCtrl.List)
		protected.GET("/webhook-logs/:id", webhookLogCtrl.GetByID)
		// Callback para gravar cada envio de webhook (lib -> emitter -> callback -> repo)
		whatsmiau.Get().SetOnWebhookSent(func(instanceID, companyID, eventType, url string, requestBody []byte, responseStatus int, responseBody []byte, err error) {
			reqBody := string(requestBody)
			if len(reqBody) > 2048 {
				reqBody = reqBody[:2048]
			}
			respBody := string(responseBody)
			if len(respBody) > 2048 {
				respBody = respBody[:2048]
			}
			errMsg := ""
			if err != nil {
				errMsg = err.Error()
			}
			var companyIDPtr *string
			if companyID != "" {
				companyIDPtr = &companyID
			}
			var statusPtr *int
			if responseStatus != 0 {
				statusPtr = &responseStatus
			}
			log := &models.WebhookLog{
				InstanceID:     instanceID,
				CompanyID:      companyIDPtr,
				EventType:      eventType,
				URL:            url,
				RequestBody:    reqBody,
				ResponseStatus: statusPtr,
				ResponseBody:   respBody,
				ErrorMessage:   errMsg,
				CreatedAt:      time.Now(),
			}
			if e := webhookLogRepo.Create(context.Background(), log); e != nil {
				zap.L().Warn("failed to record webhook log", zap.Error(e))
			}
		})
	}

	// anyAuth: rotas que qualquer usuário autenticado pode acessar (dashboard, kanban)
	anyAuth := group.Group("", middleware.JWTAuth)
	var instanceUserRepo interfaces.InstanceUserRepository
	if iu, err := instance_users.NewSQL(); err == nil {
		instanceUserRepo = iu
	}

	// Quick replies (comandos /comando por empresa)
	if qrRepo, errQR := quick_replies.NewSQL(); errQR == nil {
		qrCtrl := controllers.NewQuickReply(qrRepo)
		qrProtected := group.Group("", middleware.JWTAuth)
		qrProtected.GET("/quick-replies", qrCtrl.List)
		qrProtected.POST("/quick-replies", qrCtrl.Create)
		qrProtected.GET("/quick-replies/:id", qrCtrl.GetByID)
		qrProtected.PUT("/quick-replies/:id", qrCtrl.Update)
		qrProtected.DELETE("/quick-replies/:id", qrCtrl.Delete)
	}

	// Flows (fluxos de mensagens por empresa)
	if flowRepo, errFlow := flows.NewSQL(); errFlow == nil {
		flowCtrl := controllers.NewFlow(flowRepo)
		flowProtected := group.Group("", middleware.JWTAuth)
		flowProtected.GET("/flows", flowCtrl.List)
		flowProtected.POST("/flows", flowCtrl.Create)
		flowProtected.GET("/flows/:id", flowCtrl.GetByID)
		flowProtected.PUT("/flows/:id", flowCtrl.Update)
		flowProtected.DELETE("/flows/:id", flowCtrl.Delete)
	}

	// Agendamentos (mensagens agendadas por empresa) — mesmo grupo protected
	if schedRepo, errSched := scheduled_messages.NewSQL(); errSched == nil {
		schedCtrl := controllers.NewScheduledMessage(schedRepo)
		protected.GET("/scheduled-messages", schedCtrl.List)
		protected.POST("/scheduled-messages", schedCtrl.Create)
		protected.DELETE("/scheduled-messages/:id", schedCtrl.Cancel)
	} else {
		zap.L().Warn("scheduled_messages repo init failed, /admin/scheduled-messages routes not registered", zap.Error(errSched))
	}

	// Tags (por empresa) - qualquer usuário autenticado com company_id pode ver/gerenciar tags da empresa
	tagsProtected := group.Group("", middleware.JWTAuth)
	if tagRepo, errTag := tags.NewSQL(); errTag == nil {
		if chatTagRepo, errCT := chattags.NewSQL(); errCT == nil {
			if chatRepo, errChat := chats.NewSQL(); errChat == nil {
				tagCtrl := controllers.NewTag(tagRepo, chatTagRepo, chatRepo)
				tagsProtected.GET("/tags", tagCtrl.List)
				tagsProtected.POST("/tags", tagCtrl.Create)
				tagsProtected.GET("/tags/:id", tagCtrl.GetByID)
				tagsProtected.PUT("/tags/:id", tagCtrl.Update)
				tagsProtected.DELETE("/tags/:id", tagCtrl.Delete)
				// Kanban: reutiliza os mesmos repos (colunas = tags kanban, cards = conversas)
				redisInstance := instances.NewRedis(services.Redis())
				kanbanCtrl := controllers.NewKanban(tagRepo, chatTagRepo, chatRepo, redisInstance, instanceUserRepo, sectorUserRepo)
				anyAuth.GET("/kanban", kanbanCtrl.Get)
			}
		}
	}

	// Auditoria
	if auditRepo != nil {
		auditCtrl := controllers.NewAuditLog(auditRepo)
		protected.GET("/audit-logs", auditCtrl.List)
		protected.GET("/audit-logs/:id", auditCtrl.GetByID)
	}

	// Dashboard stats (qualquer usuário autenticado vê suas estatísticas)
	chatRepo, _ := chats.NewSQL()
	if msgRepo, errMsg := messages.NewSQL(); errMsg == nil {
		redisInstance := instances.NewRedis(services.Redis())
		dashCtrl := controllers.NewDashboard(redisInstance, instanceUserRepo, msgRepo, chatRepo)
		anyAuth.GET("/dashboard/stats", dashCtrl.Stats)
	}

	// Leads de prospecção (sherlock)
	Leads(group)
}
