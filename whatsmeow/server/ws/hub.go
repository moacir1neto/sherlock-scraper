package ws

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/coder/websocket"
	"go.uber.org/zap"
)

const maxConnsPerInstance = 10

// Hub holds WebSocket connections per instance and broadcasts messages.
type Hub struct {
	mu     sync.RWMutex
	conns  map[string]map[*connEntry]struct{} // instanceID -> set of connections
	limits map[string]int                     // instanceID -> current count (for limit)
}

type connEntry struct {
	conn       *websocket.Conn
	instanceID string
}

// NewHub creates a new Hub.
func NewHub() *Hub {
	return &Hub{
		conns:  make(map[string]map[*connEntry]struct{}),
		limits: make(map[string]int),
	}
}

// Register adds a connection for the given instanceID. Returns false if limit exceeded.
func (h *Hub) Register(instanceID string, c *websocket.Conn) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.limits[instanceID] >= maxConnsPerInstance {
		return false
	}
	e := &connEntry{conn: c, instanceID: instanceID}
	if h.conns[instanceID] == nil {
		h.conns[instanceID] = make(map[*connEntry]struct{})
	}
	h.conns[instanceID][e] = struct{}{}
	h.limits[instanceID]++
	return true
}

// Unregister removes a connection.
func (h *Hub) Unregister(instanceID string, c *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	m, ok := h.conns[instanceID]
	if !ok {
		return
	}
	for e := range m {
		if e.conn == c {
			delete(m, e)
			h.limits[instanceID]--
			if len(m) == 0 {
				delete(h.conns, instanceID)
				delete(h.limits, instanceID)
			}
			return
		}
	}
}

// BroadcastToInstance sends payload to all connections for the instance (non-blocking per connection).
func (h *Hub) BroadcastToInstance(instanceID string, payload []byte) {
	h.mu.RLock()
	m, ok := h.conns[instanceID]
	if !ok || len(m) == 0 {
		h.mu.RUnlock()
		return
	}
	// Copy refs so we don't hold lock while writing
	entries := make([]*connEntry, 0, len(m))
	for e := range m {
		entries = append(entries, e)
	}
	h.mu.RUnlock()

	for _, e := range entries {
		go func(entry *connEntry) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := entry.conn.Write(ctx, websocket.MessageText, payload); err != nil {
				zap.L().Debug("ws write failed", zap.String("instance", instanceID), zap.Error(err))
			}
		}(e)
	}
}

// BroadcastEvent sends a typed JSON event to the instance.
func (h *Hub) BroadcastEvent(instanceID string, eventType string, data interface{}) {
	payload, err := json.Marshal(map[string]interface{}{"type": eventType, "data": data})
	if err != nil {
		zap.L().Error("ws marshal failed", zap.Error(err))
		return
	}
	h.BroadcastToInstance(instanceID, payload)
}
