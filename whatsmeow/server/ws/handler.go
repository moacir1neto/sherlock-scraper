package ws

import (
	"net/http"
	"time"

	"github.com/coder/websocket"
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"go.uber.org/zap"
	"golang.org/x/net/context"
)

// ChatHandler handles WebSocket connections for the chat UI.
type ChatHandler struct {
	hub       *Hub
	instanceRepo interfaces.InstanceRepository
}

// NewChatHandler creates a ChatHandler.
func NewChatHandler(hub *Hub, instanceRepo interfaces.InstanceRepository) *ChatHandler {
	return &ChatHandler{hub: hub, instanceRepo: instanceRepo}
}

// ServeWS upgrades the connection and registers with the hub. Requires JWT (header or query param token) and query param instance_id.
func (h *ChatHandler) ServeWS(c echo.Context) error {
	instanceID := c.QueryParam("instance_id")
	if instanceID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "instance_id is required"})
	}
	// Permission (context set by AuthOrJWT from Bearer or token query param)
	role, _ := c.Get("user_role").(string)
	companyID, _ := c.Get("company_id").(string)
	ctx, cancel := context.WithTimeout(c.Request().Context(), 5*time.Second)
	defer cancel()
	instances, err := h.instanceRepo.List(ctx, instanceID)
	if err != nil || len(instances) == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"message": "instance not found"})
	}
	inst := instances[0]
	if role != "super_admin" {
		if companyID == "" || inst.CompanyID == nil || *inst.CompanyID != companyID {
			return c.JSON(http.StatusForbidden, map[string]string{"message": "access denied to this instance"})
		}
	}

	conn, err := websocket.Accept(c.Response().Writer, c.Request(), &websocket.AcceptOptions{
		OriginPatterns: []string{"localhost:3031"},
	})
	if err != nil {
		zap.L().Error("ws accept failed", zap.Error(err))
		return err
	}
	defer conn.CloseNow()

	if !h.hub.Register(instanceID, conn) {
		conn.Close(websocket.StatusPolicyViolation, "too many connections for this instance")
		return nil
	}
	defer h.hub.Unregister(instanceID, conn)

	// Read loop to detect client close; we don't process incoming messages for now
	ctxRead, cancelRead := context.WithCancel(c.Request().Context())
	defer cancelRead()
	for {
		_, _, err := conn.Read(ctxRead)
		if err != nil {
			break
		}
	}
	return nil
}
