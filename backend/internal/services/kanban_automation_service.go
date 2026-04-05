package services

import (
	"context"
	"encoding/json"
	"log"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/domain"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
	"github.com/digitalcombo/sherlock-scraper/backend/pkg/phoneutil"
)

// finalKanbanStatuses são os estágios em que um lead NÃO deve ser movido
// automaticamente, mesmo que uma mensagem do WhatsApp chegue.
//
//   - StatusContatado  → idempotência: já está no destino correto
//   - StatusGanho      → negócio fechado, não reabrir automaticamente
//   - StatusPerdido    → negócio encerrado, não reabrir automaticamente
var finalKanbanStatuses = []domain.KanbanStatus{
	domain.StatusContatado,
	domain.StatusGanho,
	domain.StatusPerdido,
}

// kanbanUpdatedEvent é o payload JSON enviado via SSE ao frontend.
// O campo "type" identifica o evento; os demais permitem o frontend atualizar
// o card correto sem re-fetch completo da lista.
//
// O campo Phone é essencial para que o WhatsMeow backend possa localizar
// seu próprio lead pelo telefone e re-emitir o evento com o UUID local —
// os dois sistemas têm bancos separados com UUIDs diferentes.
type kanbanUpdatedEvent struct {
	Type      string `json:"type"`       // sempre "lead_kanban_updated"
	LeadID    string `json:"lead_id"`    // UUID do lead no banco Sherlock
	NewStatus string `json:"new_status"` // novo KanbanStatus
	Empresa   string `json:"empresa"`    // nome da empresa (para toast no frontend)
	Phone     string `json:"phone"`      // telefone normalizado (apenas dígitos) para cross-match
}

type kanbanAutomationService struct {
	leadRepo    ports.LeadRepository
	broadcaster ports.SSEBroadcaster // pode ser nil se SSE não estiver configurado
}

// NewKanbanAutomationService cria uma instância do serviço de automação do
// Kanban com SSE broadcaster opcional.
//
// broadcaster pode ser nil (sem notificação em tempo real) — útil em testes
// ou quando o SSE não estiver disponível.
func NewKanbanAutomationService(leadRepo ports.LeadRepository, broadcaster ports.SSEBroadcaster) ports.KanbanAutomationService {
	return &kanbanAutomationService{
		leadRepo:    leadRepo,
		broadcaster: broadcaster,
	}
}

// OnWhatsAppMessageReceived implementa ports.KanbanAutomationService.
//
// Fluxo:
//  1. Normaliza rawPhone e gera variantes (lida com DDI, DDD e 9º dígito).
//  2. Busca o lead mais recente pelo telefone no banco.
//  3. Executa UPDATE condicional: só move para 'contatado' se o status
//     atual NÃO for um dos finalKanbanStatuses (operação atômica no DB).
//  4. Se houve mudança real, publica evento SSE para o frontend.
//  5. Loga o resultado — "lead não encontrado" e "status final" não são erros.
func (s *kanbanAutomationService) OnWhatsAppMessageReceived(ctx context.Context, rawPhone string) error {
	// --- Passo 1: normalização e geração de variantes ---
	normalized := phoneutil.Normalize(rawPhone)
	variants := phoneutil.Variants(normalized)

	if len(variants) == 0 {
		log.Printf("[KanbanAutomation] ⚠️  Telefone inválido ou vazio recebido: %q — ignorando", rawPhone)
		return nil
	}

	log.Printf("[KanbanAutomation] 🔍 Buscando lead para telefone %q (variantes: %v)",
		rawPhone, variants)

	// --- Passo 2: busca do lead por telefone ---
	lead, err := s.leadRepo.FindByPhone(ctx, variants)
	if err != nil {
		log.Printf("[KanbanAutomation] ❌ Erro no banco ao buscar telefone %q: %v", rawPhone, err)
		return err
	}

	if lead == nil {
		log.Printf("[KanbanAutomation] ℹ️  Nenhum lead encontrado para o telefone %q — sem ação", rawPhone)
		return nil
	}

	log.Printf("[KanbanAutomation] ✅ Lead encontrado: ID=%s | Empresa=%q | StatusAtual=%q",
		lead.ID, lead.Empresa, lead.KanbanStatus)

	// --- Passo 3: UPDATE condicional (atômico, sem race condition) ---
	moved, err := s.leadRepo.UpdateStatusConditional(
		ctx,
		lead.ID.String(),
		domain.StatusContatado,
		finalKanbanStatuses,
	)
	if err != nil {
		log.Printf("[KanbanAutomation] ❌ Falha ao atualizar status do lead %s: %v", lead.ID, err)
		return err
	}

	// --- Passo 4: notificação SSE (somente se houve mudança real no banco) ---
	if moved {
		log.Printf("[KanbanAutomation] 🎯 Lead %s (%q) movido → %q",
			lead.ID, lead.Empresa, domain.StatusContatado)
		s.publishSSEEvent(lead.ID.String(), string(domain.StatusContatado), lead.Empresa, normalized)
	} else {
		log.Printf("[KanbanAutomation] ⏭️  Lead %s (%q) não movido — status %q é final ou idempotente",
			lead.ID, lead.Empresa, lead.KanbanStatus)
	}

	return nil
}

// publishSSEEvent serializa e envia o evento para o hub SSE.
// Chamado apenas quando o DB confirmou a mudança de linha (moved == true).
// phone é o número normalizado (apenas dígitos) extraído do JID do WhatsApp.
func (s *kanbanAutomationService) publishSSEEvent(leadID, newStatus, empresa, phone string) {
	if s.broadcaster == nil {
		return
	}

	payload := kanbanUpdatedEvent{
		Type:      "lead_kanban_updated",
		LeadID:    leadID,
		NewStatus: newStatus,
		Empresa:   empresa,
		Phone:     phone,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[KanbanAutomation] ⚠️  Falha ao serializar evento SSE: %v", err)
		return
	}

	s.broadcaster.Publish(string(data))
	log.Printf("[KanbanAutomation] 📡 Evento SSE publicado: lead=%s status=%s", leadID, newStatus)
}
