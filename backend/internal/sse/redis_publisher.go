package sse

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/config"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/logger"
	"github.com/digitalcombo/sherlock-scraper/backend/pkg/events"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// NotificationsChannel é o canal Redis Pub/Sub para notificações de negócio.
const NotificationsChannel = "sherlock:notifications"

type redisPublisher struct {
	client *redis.Client
}

// NewRedisPublisher cria uma nova instância do publisher Redis para eventos de negócio.
func NewRedisPublisher() *redisPublisher {
	addr := config.Get().RedisURL
	if addr == "" {
		addr = "localhost:6379"
	}

	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		DialTimeout:  5 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	return &redisPublisher{client: client}
}

// PublishNotification implementa ports.EventPublisher.
func (p *redisPublisher) PublishNotification(ctx context.Context, companyID string, payload events.EventPayloadV1) error {
	l := logger.Ctx(ctx).With(
		zap.String("company_id", companyID),
		zap.String("event_type", string(payload.Type)),
		zap.Int("payload_version", payload.Version),
	)

	data, err := json.Marshal(payload)
	if err != nil {
		l.Error("failed_to_marshal_notification_payload", zap.Error(err))
		return fmt.Errorf("marshal payload: %w", err)
	}

	// Timeout rigoroso para não travar a thread de negócio
	publishCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := p.client.Publish(publishCtx, NotificationsChannel, string(data)).Err(); err != nil {
		l.Error("failed_to_publish_to_redis", zap.Error(err))
		return fmt.Errorf("publish to redis: %w", err)
	}

	l.Info("notification_published_successfully", zap.String("channel", NotificationsChannel))
	return nil
}
