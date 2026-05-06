package services

import (
	"encoding/json"
	"sync"

	"go.uber.org/zap"
)

const handoffChanBuffer = 16

// HandoffHub distribui eventos de handoff (acionar_humano=true) para todos
// os clientes SSE conectados ao painel WhatsMiau.
//
// Thread-safe: RWMutex protege o map de clientes.
// Publish usa não-bloqueante (select/default) para evitar stall em clientes lentos.
type HandoffHub struct {
	mu      sync.RWMutex
	clients map[chan string]struct{}
}

// HandoffEvent é o payload emitido quando a IA decide acionar um humano.
type HandoffEvent struct {
	Type       string `json:"type"` // sempre "handoff_alert"
	ChatID     string `json:"chat_id"`
	LeadName   string `json:"lead_name"`
	InstanceID string `json:"instance_id"`
	RemoteJID  string `json:"remote_jid"`
}

// NewHandoffHub cria um hub pronto para uso.
func NewHandoffHub() *HandoffHub {
	return &HandoffHub{
		clients: make(map[chan string]struct{}),
	}
}

// Subscribe registra um cliente SSE e retorna seu canal dedicado.
// O caller deve chamar Unsubscribe(ch) ao encerrar a conexão.
func (h *HandoffHub) Subscribe() chan string {
	ch := make(chan string, handoffChanBuffer)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

// Unsubscribe remove o cliente do hub e fecha seu canal.
func (h *HandoffHub) Unsubscribe(ch chan string) {
	h.mu.Lock()
	if _, ok := h.clients[ch]; ok {
		delete(h.clients, ch)
		close(ch)
	}
	h.mu.Unlock()
}

// PublishHandoff serializa e emite um HandoffEvent para todos os clientes.
func (h *HandoffHub) PublishHandoff(evt HandoffEvent) {
	evt.Type = "handoff_alert"
	data, err := json.Marshal(evt)
	if err != nil {
		zap.L().Warn("[HandoffHub] falha ao serializar evento", zap.Error(err))
		return
	}
	h.publish(string(data))
}

func (h *HandoffHub) publish(data string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for ch := range h.clients {
		select {
		case ch <- data:
		default:
			// Canal cheio — descarta para este cliente; frontend reconecta automaticamente.
		}
	}
}
