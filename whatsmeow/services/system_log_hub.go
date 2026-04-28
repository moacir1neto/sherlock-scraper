package services

import (
	"encoding/json"
	"sync"
	"time"

	"go.uber.org/zap/zapcore"
)

const systemLogChanBuffer = 64

// LogLevel representa o nível de severidade de um log.
type LogLevel string

const (
	LogLevelInfo  LogLevel = "info"
	LogLevelWarn  LogLevel = "warn"
	LogLevelError LogLevel = "error"
)

// LogCategory agrupa o tipo de evento.
type LogCategory string

const (
	LogCategorySystem   LogCategory = "system"
	LogCategoryMessage  LogCategory = "whatsapp"
	LogCategoryCampaign LogCategory = "campaign"
	LogCategoryAgent    LogCategory = "agent"
)

// SystemLogEvent é o payload enviado ao frontend via SSE.
type SystemLogEvent struct {
	Type      string      `json:"type"`       // sempre "system_log"
	Level     LogLevel    `json:"level"`
	Category  LogCategory `json:"category"`
	Message   string      `json:"message"`
	Detail    string      `json:"detail,omitempty"`
	Instance  string      `json:"instance,omitempty"`
	Timestamp string      `json:"timestamp"`
}

// SystemLogHub distribui eventos de log em tempo real para todos os clientes SSE.
// Thread-safe via RWMutex. Publish não-bloqueante para evitar stall.
type SystemLogHub struct {
	mu      sync.RWMutex
	clients map[chan string]struct{}
}

// NewSystemLogHub cria o hub pronto para uso.
func NewSystemLogHub() *SystemLogHub {
	return &SystemLogHub{
		clients: make(map[chan string]struct{}),
	}
}

// Subscribe registra um cliente SSE e retorna seu canal dedicado.
func (h *SystemLogHub) Subscribe() chan string {
	ch := make(chan string, systemLogChanBuffer)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

// Unsubscribe remove o cliente do hub e fecha seu canal.
func (h *SystemLogHub) Unsubscribe(ch chan string) {
	h.mu.Lock()
	if _, ok := h.clients[ch]; ok {
		delete(h.clients, ch)
		close(ch)
	}
	h.mu.Unlock()
}

// Publish emite um SystemLogEvent para todos os clientes conectados.
func (h *SystemLogHub) Publish(evt SystemLogEvent) {
	evt.Type = "system_log"
	if evt.Timestamp == "" {
		evt.Timestamp = time.Now().Format(time.RFC3339)
	}
	data, err := json.Marshal(evt)
	if err != nil {
		return
	}
	h.publish(string(data))
}

func (h *SystemLogHub) publish(data string) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range h.clients {
		select {
		case ch <- data:
		default:
			// Canal cheio — descarta para este cliente sem bloquear.
		}
	}
}

// ConnectedCount retorna o número de clientes SSE conectados.
func (h *SystemLogHub) ConnectedCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// ── Zap WriteSyncer ───────────────────────────────────────────────────────────

// HubZapCore é um zapcore.Core que intercepta entradas de log com nível ≥ Warn
// e as publica no SystemLogHub como eventos SSE.
// É adicionado ao logger global via zap.WithOptions(zap.WrapCore(...)).
type HubZapCore struct {
	hub     *SystemLogHub
	minLevel zapcore.Level
}

// NewHubZapCore cria o core que captura logs a partir de minLevel.
func NewHubZapCore(hub *SystemLogHub, minLevel zapcore.Level) *HubZapCore {
	return &HubZapCore{hub: hub, minLevel: minLevel}
}

func (c *HubZapCore) Enabled(lvl zapcore.Level) bool {
	return lvl >= c.minLevel
}

func (c *HubZapCore) With(_ []zapcore.Field) zapcore.Core { return c }

func (c *HubZapCore) Check(entry zapcore.Entry, ce *zapcore.CheckedEntry) *zapcore.CheckedEntry {
	if c.Enabled(entry.Level) {
		return ce.AddCore(entry, c)
	}
	return ce
}

func (c *HubZapCore) Write(entry zapcore.Entry, fields []zapcore.Field) error {
	if c.hub == nil {
		return nil
	}

	level := LogLevelInfo
	if entry.Level >= zapcore.ErrorLevel {
		level = LogLevelError
	} else if entry.Level >= zapcore.WarnLevel {
		level = LogLevelWarn
	}

	// Extrai instance dos fields se disponível
	instance := ""
	for _, f := range fields {
		if f.Key == "instance" || f.Key == "instanceID" {
			instance = f.String
			break
		}
	}

	category := LogCategorySystem
	msg := entry.Message
	switch {
	case len(msg) > 12 && msg[:12] == "[SalesAgent]":
		category = LogCategoryAgent
	case len(msg) > 12 && msg[:12] == "[ChatWorker]":
		category = LogCategoryMessage
	case len(msg) > 16 && msg[:16] == "[LeadPublisher] ":
		category = LogCategoryCampaign
	}

	c.hub.Publish(SystemLogEvent{
		Level:    level,
		Category: category,
		Message:  entry.Message,
		Instance: instance,
	})
	return nil
}

func (c *HubZapCore) Sync() error { return nil }
