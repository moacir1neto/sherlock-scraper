package services

import (
	"context"

	"github.com/go-redis/redis/v8"
	"github.com/hibiken/asynq"
	"go.uber.org/zap"
)

// NotificationSubscriber escuta o canal Redis e enfileira no Asynq
type NotificationSubscriber struct {
	redis       *redis.Client
	asynqClient *asynq.Client
}

func NewNotificationSubscriber(r *redis.Client, a *asynq.Client) *NotificationSubscriber {
	return &NotificationSubscriber{
		redis:       r,
		asynqClient: a,
	}
}

// Start inicia o loop de subscrição
func (s *NotificationSubscriber) Start(ctx context.Context) {
	pubsub := s.redis.Subscribe(ctx, "sherlock:notifications")
	defer pubsub.Close()

	zap.L().Info("NotificationSubscriber iniciado", zap.String("channel", "sherlock:notifications"))

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-ch:
			s.handleMessage(msg.Payload)
		}
	}
}

func (s *NotificationSubscriber) handleMessage(payload string) {
	zap.L().Debug("Nova notificação recebida via Redis", zap.String("payload", payload))

	// Enfileira no Asynq para processamento resiliente
	task, err := NewNotificationTask(payload)
	if err != nil {
		zap.L().Error("Erro ao criar task de notificação", zap.Error(err))
		return
	}

	info, err := s.asynqClient.Enqueue(task)
	if err != nil {
		zap.L().Error("Erro ao enfileirar task no Asynq", zap.Error(err))
		return
	}

	zap.L().Info("Notificação enfileirada no Asynq", zap.String("task_id", info.ID))
}

// Task types
const TypeNotificationDelivery = "notification:delivery"

func NewNotificationTask(payload string) (*asynq.Task, error) {
	return asynq.NewTask(TypeNotificationDelivery, []byte(payload)), nil
}
