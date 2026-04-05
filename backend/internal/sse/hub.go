// Package sse fornece um hub de broadcast in-memory para Server-Sent Events.
//
// Design: cada cliente conectado recebe um canal Go dedicado. O hub mantém
// um set de clientes ativos e distribui mensagens para todos via Publish().
//
// Segurança de concorrência: sync.RWMutex protege o map de clientes.
// Subscribe/Unsubscribe são as únicas operações que adquirem o write-lock;
// Publish usa read-lock para iterar sem bloquear novas inscrições longas.
//
// Limitações / Escalabilidade:
//   - In-memory: funciona para um único processo. Em multi-instância, substituir
//     por um Redis Pub/Sub subscriber dedicado ao SSE.
//   - Sem persistência: clientes que se conectam após um evento não recebem
//     eventos anteriores (correto para notificações "live").
package sse

import (
	"sync"
)

const clientChanBuffer = 16 // buffer para absorver burst sem bloquear Publish

// Hub gerencia todos os clientes SSE conectados e distribui eventos.
type Hub struct {
	mu      sync.RWMutex
	clients map[chan string]struct{}
}

// NewHub cria um Hub pronto para uso.
func NewHub() *Hub {
	return &Hub{
		clients: make(map[chan string]struct{}),
	}
}

// Subscribe registra um novo cliente e retorna seu canal de recebimento.
// O caller deve chamar Unsubscribe(ch) quando a conexão SSE for encerrada
// (via defer no handler).
func (h *Hub) Subscribe() chan string {
	ch := make(chan string, clientChanBuffer)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

// Unsubscribe remove o cliente do hub e fecha seu canal.
// É seguro chamar mesmo se o canal já foi removido.
func (h *Hub) Unsubscribe(ch chan string) {
	h.mu.Lock()
	if _, ok := h.clients[ch]; ok {
		delete(h.clients, ch)
		close(ch)
	}
	h.mu.Unlock()
}

// Publish envia data para todos os clientes conectados.
// Usa um envio não-bloqueante (select com default) por cliente: se o buffer
// do canal estiver cheio (cliente lento), o evento é descartado para aquele
// cliente sem travar os demais.
func (h *Hub) Publish(data string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for ch := range h.clients {
		select {
		case ch <- data:
		default:
			// Canal do cliente cheio — descarta o evento para este cliente
			// para não bloquear o broadcast. O frontend tem reconexão automática.
		}
	}
}
