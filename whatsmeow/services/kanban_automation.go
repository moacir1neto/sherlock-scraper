package services

import (
	"context"

	"github.com/verbeux-ai/whatsmiau/interfaces"
	"go.uber.org/zap"
)

type KanbanAutomation interface {
	ProcessIncomingMessage(ctx context.Context, instanceID, phone string) error
	ProcessOutgoingMessage(ctx context.Context, instanceID, phone string) error
}

type kanbanAutomation struct {
	leadRepo     interfaces.LeadRepository
	instanceRepo interfaces.InstanceRepository
	broadcaster  ChatBroadcaster
}

func NewKanbanAutomation(leadRepo interfaces.LeadRepository, instanceRepo interfaces.InstanceRepository, broadcaster ChatBroadcaster) KanbanAutomation {
	return &kanbanAutomation{
		leadRepo:     leadRepo,
		instanceRepo: instanceRepo,
		broadcaster:  broadcaster,
	}
}

// process idempotently updates lead kanban status based on direction
func (k *kanbanAutomation) process(ctx context.Context, instanceID, phone, targetStatus string, finalStatuses []string) error {
	instancesList, err := k.instanceRepo.List(ctx, instanceID)
	if err != nil || len(instancesList) == 0 {
		zap.L().Warn("[KanbanAutomation] instance not found", zap.String("instance_id", instanceID))
		return err
	}
	instance := &instancesList[0]

	variants := []string{phone, "55" + phone} // simplified variant check, should match what FindByPhone handles natively
	
	lead, err := k.leadRepo.FindByPhone(ctx, instance.CompanyID, variants)
	if err != nil {
		zap.L().Error("[KanbanAutomation] failed to search lead", zap.Error(err))
		return err
	}

	if lead == nil {
		return nil // Not a lead (probably just a normal WhatsApp contact)
	}

	// Idempotency / final status check
	for _, st := range finalStatuses {
		if lead.KanbanStatus == st {
			zap.L().Debug("[KanbanAutomation] lead already in final status", zap.String("id", lead.ID), zap.String("status", lead.KanbanStatus))
			return nil
		}
	}

	if lead.KanbanStatus == targetStatus {
		return nil
	}

	err = k.leadRepo.UpdateStatus(ctx, lead.ID, instance.CompanyID, targetStatus)
	if err != nil {
		zap.L().Error("[KanbanAutomation] failed to update lead status", zap.Error(err))
		return err
	}

	zap.L().Info("[KanbanAutomation] lead moved", zap.String("lead", lead.Name), zap.String("new_status", targetStatus))

	// Optionally notify via SSE/WS
	if k.broadcaster != nil {
		eventPayload := map[string]interface{}{
			"type":       "lead_kanban_updated",
			"lead_id":    lead.ID,
			"new_status": targetStatus,
			"empresa":    lead.Name,
			"phone":      phone,
		}
		k.broadcaster.BroadcastEvent(instanceID, "lead_kanban_updated", eventPayload)
	}

	return nil
}

func (k *kanbanAutomation) ProcessIncomingMessage(ctx context.Context, instanceID, phone string) error {
	// FromMe = false (lead responded us)
	return k.process(ctx, instanceID, phone, "retornado", []string{"ganho", "perdido"})
}

func (k *kanbanAutomation) ProcessOutgoingMessage(ctx context.Context, instanceID, phone string) error {
	// FromMe = true (we sent a message, e.g. via Bulk Send)
	return k.process(ctx, instanceID, phone, "contatado", []string{"contatado", "retornado", "ganho", "perdido"})
}
