package ports

import (
	"context"
)

type WhatsAppService interface {
	SendTextMessage(ctx context.Context, instanceID, number, text string) error
	GetInstances(ctx context.Context) ([]map[string]interface{}, error)
}
