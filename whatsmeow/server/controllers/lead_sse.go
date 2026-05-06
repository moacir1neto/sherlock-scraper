package controllers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

// KanbanMovedChannel é o canal Redis Pub/Sub no qual o Sherlock publica
// eventos de movimentação de Kanban. Deve ser idêntico ao definido em
// backend/internal/sse/redis_broadcaster.go.
const KanbanMovedChannel = "sherlock:leads:kanban_moved"

// sherlockKanbanEvent é o payload recebido do Sherlock via Redis.
// Deve ser compatível com o kanbanUpdatedEvent do Sherlock.
type sherlockKanbanEvent struct {
	Type      string `json:"type"`
	LeadID    string `json:"lead_id"` // UUID do banco Sherlock — NÃO usar para match local
	NewStatus string `json:"new_status"`
	Empresa   string `json:"empresa"`
	Phone     string `json:"phone"` // telefone normalizado (apenas dígitos) para cross-match
}

// localKanbanEvent é o payload enviado ao frontend WhatsMeow via SSE.
// Usa o UUID do banco local (whatsmiau) para que o frontend faça o match correto.
type localKanbanEvent struct {
	Type      string `json:"type"`
	LeadID    string `json:"lead_id"` // UUID do banco WhatsMeow (local)
	NewStatus string `json:"new_status"`
	Empresa   string `json:"empresa"`
}

// reNonDigits remove qualquer caractere não-numérico para normalização de telefone.
var reNonDigits = regexp.MustCompile(`[^0-9]`)

// normalizePhone retorna apenas os dígitos do número.
func normalizePhone(phone string) string {
	return reNonDigits.ReplaceAllString(strings.TrimSpace(phone), "")
}

// phoneVariants gera variantes normalizadas de um número brasileiro para
// maximizar a chance de encontrar o lead independente do formato armazenado.
// Replica a lógica de backend/pkg/phoneutil/normalizer.go (Sherlock).
func phoneVariants(normalized string) []string {
	if normalized == "" {
		return nil
	}

	seen := make(map[string]struct{})
	add := func(s string) {
		if s != "" {
			seen[s] = struct{}{}
		}
	}

	withoutDDI := normalized
	if strings.HasPrefix(normalized, "55") && len(normalized) >= 12 {
		withoutDDI = normalized[2:]
		add(normalized)
	} else {
		add("55" + normalized)
	}
	add(withoutDDI)

	switch len(withoutDDI) {
	case 11: // DDD(2) + 9 + número(8)
		ddd := withoutDDI[:2]
		localWith9 := withoutDDI[2:]
		localNo9 := withoutDDI[3:]
		add(localWith9)
		add(ddd + localNo9)
		add(localNo9)
	case 10: // DDD(2) + número(8) — formato legado
		ddd := withoutDDI[:2]
		local8 := withoutDDI[2:]
		local9 := "9" + local8
		add(local8)
		add(ddd + local9)
		add("55" + ddd + local9)
		add(local9)
	}

	result := make([]string, 0, len(seen))
	for k := range seen {
		result = append(result, k)
	}
	return result
}

// LeadSSE expõe um endpoint SSE que:
//  1. Assina o canal Redis do Sherlock (sherlock:leads:kanban_moved).
//  2. Para cada evento, busca o lead correspondente no banco WhatsMeow pelo telefone.
//  3. Atualiza o status no banco WhatsMeow (idempotente — não sobrescreve ganho/perdido).
//  4. Re-emite o evento com o UUID local para o frontend WhatsMeow.
//
// Isso garante que (a) o banco local fica sincronizado e (b) o frontend usa sempre
// IDs do seu próprio banco, eliminando o mismatch entre os dois sistemas.
type LeadSSE struct {
	redis    *redis.Client
	leadRepo interfaces.LeadRepository
}

// NewLeadSSE cria o controller injetando o client Redis e o repositório de leads.
func NewLeadSSE(redis *redis.Client, leadRepo interfaces.LeadRepository) *LeadSSE {
	return &LeadSSE{redis: redis, leadRepo: leadRepo}
}

// Stream é o handler Echo para GET /admin/leads/events?token=JWT
func (h *LeadSSE) Stream(c echo.Context) error {
	// --- Autenticação interna via ?token= (EventSource não suporta headers) ---
	tokenStr := c.QueryParam("token")
	if tokenStr == "" {
		return echo.NewHTTPError(http.StatusUnauthorized, "token query parameter is required")
	}

	claims, err := utils.ValidateToken(tokenStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired token")
	}

	if claims.Role != "admin" && claims.Role != "super_admin" {
		return echo.NewHTTPError(http.StatusForbidden, "admin access required")
	}

	companyID := ""
	if claims.CompanyID != nil {
		companyID = *claims.CompanyID
	}

	// --- Headers SSE + CORS explícito ---
	if origin := c.Request().Header.Get("Origin"); origin != "" {
		c.Response().Header().Set("Access-Control-Allow-Origin", origin)
		c.Response().Header().Set("Access-Control-Allow-Credentials", "true")
	}
	c.Response().Header().Set("Content-Type", "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")
	c.Response().Header().Set("X-Accel-Buffering", "no")
	c.Response().WriteHeader(http.StatusOK)

	ctx := c.Request().Context()

	// --- Subscrição Redis ---
	pubsub := h.redis.Subscribe(ctx, KanbanMovedChannel)
	defer func() {
		if err := pubsub.Close(); err != nil && ctx.Err() == nil {
			zap.L().Warn("[LeadSSE] erro ao fechar pubsub", zap.Error(err))
		}
	}()

	if _, err := pubsub.Receive(ctx); err != nil {
		return nil
	}

	zap.L().Info("[LeadSSE] cliente conectado",
		zap.String("user_id", claims.UserID),
		zap.String("company_id", companyID),
	)

	// Goroutine receptora: ReceiveMessage é bloqueante e não conflita com Channel().
	msgCh := make(chan string, 8)
	go func() {
		for {
			msg, err := pubsub.ReceiveMessage(ctx)
			if err != nil {
				close(msgCh)
				return
			}
			select {
			case msgCh <- msg.Payload:
			default:
				// Buffer cheio — descarta sem bloquear o broadcast.
			}
		}
	}()

	fmt.Fprintf(c.Response().Writer, ": connected\n\n")
	c.Response().Flush()

	heartbeat := time.NewTicker(30 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-ctx.Done():
			zap.L().Info("[LeadSSE] cliente desconectado", zap.String("user_id", claims.UserID))
			return nil

		case payload, ok := <-msgCh:
			if !ok {
				return nil
			}
			// Processa o evento: atualiza DB local e re-emite com UUID local.
			if localPayload := h.processEvent(payload, companyID); localPayload != "" {
				fmt.Fprintf(c.Response().Writer, "data: %s\n\n", localPayload)
				c.Response().Flush()
			}

		case <-heartbeat.C:
			fmt.Fprintf(c.Response().Writer, ": heartbeat\n\n")
			c.Response().Flush()
		}
	}
}

// processEvent recebe o payload bruto do Sherlock, localiza o lead no banco
// WhatsMeow pelo telefone, atualiza o status e retorna o JSON re-emitido
// com o UUID local. Retorna "" se não há lead para atualizar.
func (h *LeadSSE) processEvent(payload, companyID string) string {
	var evt sherlockKanbanEvent
	if err := json.Unmarshal([]byte(payload), &evt); err != nil {
		zap.L().Warn("[LeadSSE] payload inválido do Sherlock", zap.Error(err))
		return ""
	}

	if evt.Type != "lead_kanban_updated" || evt.Phone == "" {
		return ""
	}

	variants := phoneVariants(normalizePhone(evt.Phone))
	if len(variants) == 0 {
		return ""
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Estratégia 1: match por telefone (preferencial — mais preciso)
	lead, err := h.leadRepo.FindByPhone(ctx, companyID, variants)
	if err != nil {
		zap.L().Warn("[LeadSSE] erro ao buscar lead por telefone",
			zap.String("phone", evt.Phone),
			zap.Error(err),
		)
		return ""
	}

	// Estratégia 2: fallback por nome — necessário quando os dois sistemas
	// armazenam telefones diferentes para o mesmo negócio (ex: número de celular
	// vs. número fixo capturado em raspagens diferentes).
	if lead == nil && evt.Empresa != "" {
		zap.L().Debug("[LeadSSE] telefone não encontrado, tentando match por nome",
			zap.String("phone", evt.Phone),
			zap.String("empresa", evt.Empresa),
		)
		lead, err = h.leadRepo.FindByName(ctx, companyID, evt.Empresa)
		if err != nil {
			zap.L().Warn("[LeadSSE] erro ao buscar lead por nome",
				zap.String("empresa", evt.Empresa),
				zap.Error(err),
			)
			return ""
		}
	}

	if lead == nil {
		zap.L().Debug("[LeadSSE] lead não encontrado no banco local (telefone + nome)",
			zap.String("phone", evt.Phone),
			zap.String("empresa", evt.Empresa),
		)
		return ""
	}

	// Idempotência: não retroced leads que já estão em estágios avançados.
	if lead.KanbanStatus == "ganho" || lead.KanbanStatus == "perdido" || lead.KanbanStatus == evt.NewStatus {
		zap.L().Debug("[LeadSSE] lead não movido — status final ou idempotente",
			zap.String("lead_id", lead.ID),
			zap.String("status_atual", lead.KanbanStatus),
		)
		return ""
	}

	// Atualiza o banco WhatsMeow.
	if err := h.leadRepo.UpdateStatus(ctx, lead.ID, lead.CompanyID, evt.NewStatus); err != nil {
		zap.L().Warn("[LeadSSE] falha ao atualizar status no banco local",
			zap.String("lead_id", lead.ID),
			zap.Error(err),
		)
		return ""
	}

	zap.L().Info("[LeadSSE] lead movido no banco local",
		zap.String("lead_id", lead.ID),
		zap.String("name", lead.Name),
		zap.String("new_status", evt.NewStatus),
	)

	// Re-emite com UUID local para que o frontend faça o match correto.
	out := localKanbanEvent{
		Type:      "lead_kanban_updated",
		LeadID:    lead.ID,
		NewStatus: evt.NewStatus,
		Empresa:   lead.Name,
	}
	data, err := json.Marshal(out)
	if err != nil {
		return ""
	}
	return string(data)
}
