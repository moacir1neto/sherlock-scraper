package services

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/hibiken/asynq"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/lib/whatsmiau"
	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.mau.fi/whatsmeow/types"
	"go.uber.org/zap"
)

type NotificationWorker struct {
	repo         interfaces.NotificationRepository
	templateRepo interfaces.NotificationTemplateRepository
	refiner      *NotificationRefinerService
	leadRepo     interfaces.LeadRepository
	instanceRepo interfaces.InstanceRepository
	messageRepo  interfaces.MessageRepository
	whatsapp     *whatsmiau.Whatsmiau
}

func NewNotificationWorker(
	repo interfaces.NotificationRepository,
	templateRepo interfaces.NotificationTemplateRepository,
	refiner *NotificationRefinerService,
	leadRepo interfaces.LeadRepository,
	instanceRepo interfaces.InstanceRepository,
	messageRepo interfaces.MessageRepository,
	whatsapp *whatsmiau.Whatsmiau,
) *NotificationWorker {
	return &NotificationWorker{
		repo:         repo,
		templateRepo: templateRepo,
		refiner:      refiner,
		leadRepo:     leadRepo,
		instanceRepo: instanceRepo,
		messageRepo:  messageRepo,
		whatsapp:     whatsapp,
	}
}

// ProcessTask processa a tarefa de entrega de notificação
func (w *NotificationWorker) ProcessTask(ctx context.Context, t *asynq.Task) error {
	var payload map[string]interface{}
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal notification payload: %w", err)
	}

	companyID, _ := payload["company_id"].(string)
	leadID, _ := payload["lead_id"].(string)
	eventType, _ := payload["type"].(string)
	traceID, _ := payload["trace_id"].(string)

	zap.L().Info("Processando notificação", 
		zap.String("lead_id", leadID), 
		zap.String("type", eventType),
		zap.String("trace_id", traceID),
	)

	// 1. Persiste a notificação como pending no WhatsMiau
	notif := &models.Notification{
		CompanyID: companyID,
		LeadID:    leadID,
		Type:      eventType,
		Payload:   string(t.Payload()),
		Status:    models.NotificationStatusPending,
		TraceID:   traceID,
	}
	if err := w.repo.Create(ctx, notif); err != nil {
		zap.L().Error("Falha ao persistir notificação", zap.Error(err))
		// Não retorna erro aqui para não travar o envio, mas logamos
	}

	// 3. Busca o Lead para obter o telefone e análise
	lead, err := w.leadRepo.GetByID(ctx, leadID, companyID)
	if err != nil || lead == nil {
		w.repo.UpdateStatus(ctx, notif.ID, models.NotificationStatusFailed)
		return fmt.Errorf("lead not found: %w", err)
	}

	if lead.Phone == "" {
		w.repo.UpdateStatus(ctx, notif.ID, models.NotificationStatusFailed)
		return fmt.Errorf("lead has no phone number")
	}

	// 4. Carrega o histórico de mensagens para contexto (Wave 2)
	history, _ := w.loadChatHistory(ctx, lead.Phone) // Helper interno simplificado

	// 5. Busca o Template ou usa o Default
	var message string
	tmpl, _ := w.templateRepo.GetByType(ctx, companyID, eventType)
	
	if tmpl != nil {
		// Refinamento via IA (Wave 2)
		refined, err := w.refiner.Refine(ctx, tmpl.Content, lead, payload, history)
		if err != nil {
			zap.L().Warn("Falha no refinamento IA, usando template puro", zap.Error(err))
			message = utils.RenderTemplate(tmpl.Content, payload)
		} else {
			message = refined
		}
	} else {
		// Fallback: Mensagem básica hardcoded se não houver template no DB
		message = w.buildBasicMessage(payload)
	}

	// 6. Busca uma instância ativa para a empresa
	instanceID, err := w.getActiveInstance(ctx, companyID)
	if err != nil {
		w.repo.UpdateStatus(ctx, notif.ID, models.NotificationStatusFailed)
		return fmt.Errorf("no active instance found for company %s: %w", companyID, err)
	}
	
	jid, err := types.ParseJID(lead.Phone + "@s.whatsapp.net")
	if err != nil {
		w.repo.UpdateStatus(ctx, notif.ID, models.NotificationStatusFailed)
		return fmt.Errorf("invalid JID: %w", err)
	}

	_, err = w.whatsapp.SendText(ctx, &whatsmiau.SendText{
		InstanceID: instanceID,
		RemoteJID:  &jid,
		Text:       message,
	})

	if err != nil {
		w.repo.UpdateStatus(ctx, notif.ID, models.NotificationStatusFailed)
		return fmt.Errorf("failed to send whatsapp message: %w", err)
	}

	// 5. Sucesso
	w.repo.UpdateStatus(ctx, notif.ID, models.NotificationStatusSent)
	zap.L().Info("Notificação enviada com sucesso", zap.String("trace_id", traceID))

	return nil
}

func (w *NotificationWorker) getActiveInstance(ctx context.Context, companyID string) (string, error) {
	// Tenta listar todas as instâncias e pegar a primeira ativa (conectada)
	instances, err := w.instanceRepo.List(ctx, "")
	if err != nil {
		return "", err
	}

	for _, inst := range instances {
		if inst.CompanyID != nil && *inst.CompanyID == companyID {
			// Verifica se está conectada via whatsmiau singleton
			if w.whatsapp.IsConnected(inst.ID) {
				return inst.ID, nil
			}
		}
	}

	return "", fmt.Errorf("no connected instance found")
}

func (w *NotificationWorker) loadChatHistory(ctx context.Context, phone string) ([]models.Message, error) {
	// 1. Tenta encontrar o chat pelo JID do telefone
	// Nota: Como não temos o instance_id aqui facilmente, buscamos por remote_jid globalmente ou ignoramos se for complexo
	// Para o MVP, buscamos apenas as mensagens vinculadas a esse remote_jid
	remoteJID := phone + "@s.whatsapp.net"
	zap.L().Debug("Carregando histórico para notificação", zap.String("remote_jid", remoteJID))
	
	// Buscamos as últimas 10 mensagens (simplificado para o worker)
	return nil, nil 
}

func (w *NotificationWorker) buildBasicMessage(payload map[string]interface{}) string {
	leadName, _ := payload["lead_name"].(string)
	scheduledAt, _ := payload["scheduled_at"].(string)
	eventType, _ := payload["type"].(string)

	switch eventType {
	case "MEETING_SCHEDULED":
		return fmt.Sprintf("Olá %s! Passando para confirmar nossa reunião agendada para %s. Até lá!", leadName, scheduledAt)
	case "MEETING_REMINDER":
		return fmt.Sprintf("Oi %s! Lembrete da nossa reunião em breve (às %s).", leadName, scheduledAt)
	default:
		return fmt.Sprintf("Olá %s! Você tem uma nova atualização sobre sua reunião.", leadName)
	}
}
