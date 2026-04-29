package services

import (
	"encoding/json"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"go.uber.org/zap"
	"golang.org/x/net/context"
)

// WhatsAppMessagesChannel é o canal Redis Pub/Sub para eventos de mensagens
// recebidas. O Sherlock (subscriber) escuta exatamente este canal.
// O nome é compartilhado — qualquer mudança aqui exige mudança no Sherlock.
const WhatsAppMessagesChannel = "whatsapp:messages:received"

// leadMessagePayload é o contrato de serialização do evento.
// Deve permanecer compatível com o WhatsAppMessageEvent do handlers/redis_subscriber.go
// no módulo Sherlock.
type leadMessagePayload struct {
	MessageID  string    `json:"message_id"`
	Phone      string    `json:"phone"`
	InstanceID string    `json:"instance_id"`
	ReceivedAt time.Time `json:"received_at"`
}

// redisLeadEventPublisher implementa interfaces.LeadEventPublisher usando
// Redis Pub/Sub (go-redis/v8).
//
// Reutiliza o client Redis já existente em services.Redis() — sem nova conexão.
type redisLeadEventPublisher struct {
	client *redis.Client
}

// NewRedisLeadEventPublisher cria o publisher injetando o client Redis.
// Recebe a instância existente via services.Redis() para não abrir nova conexão.
func NewRedisLeadEventPublisher(client *redis.Client) interfaces.LeadEventPublisher {
	return &redisLeadEventPublisher{client: client}
}

// PublishIncomingMessage implementa interfaces.LeadEventPublisher.
//
// Serializa o evento para JSON e publica no canal Redis de forma assíncrona
// (chamado dentro de uma goroutine no ChatWorker).
//
// Se o Redis estiver indisponível, loga um warning e retorna o erro sem
// propagar pânico — o fluxo de persistência de mensagens não é afetado.
func (p *redisLeadEventPublisher) PublishIncomingMessage(ctx context.Context, messageID string, phone string, instanceID string) error {
	payload := leadMessagePayload{
		MessageID:  messageID,
		Phone:      phone,
		InstanceID: instanceID,
		ReceivedAt: time.Now().UTC(),
	}

	data, err := json.Marshal(payload)
	if err != nil {
		// Erro de serialização é improvável mas logamos para visibilidade
		zap.L().Warn("[LeadPublisher] falha ao serializar evento",
			zap.String("phone", phone),
			zap.String("instance_id", instanceID),
			zap.Error(err),
		)
		return err
	}

	if err := p.client.Publish(ctx, WhatsAppMessagesChannel, data).Err(); err != nil {
		zap.L().Warn("[LeadPublisher] falha ao publicar no Redis",
			zap.String("channel", WhatsAppMessagesChannel),
			zap.String("phone", phone),
			zap.Error(err),
		)
		return err
	}

	zap.L().Debug("[LeadPublisher] evento publicado",
		zap.String("channel", WhatsAppMessagesChannel),
		zap.String("phone", phone),
		zap.String("instance_id", instanceID),
	)
	return nil
}
