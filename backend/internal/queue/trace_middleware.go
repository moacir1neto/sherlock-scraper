package queue

import (
	"context"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/logger"
	"github.com/hibiken/asynq"
	"go.uber.org/zap"
)

// traceMiddleware injeta trace_id, task_id e campos de negócio no contexto
// de cada tarefa processada pelo Asynq, garantindo rastreabilidade nos workers.
func traceMiddleware(next asynq.Handler) asynq.Handler {
	return asynq.HandlerFunc(func(ctx context.Context, t *asynq.Task) error {
		traceID := logger.NewTraceID()
		ctx = logger.WithTraceID(ctx, traceID)
		ctx = logger.WithTaskID(ctx, t.Type())

		logger.FromContext(ctx).Info("task_started",
			zap.String("task_type", t.Type()),
			zap.Int("payload_size", len(t.Payload())),
		)

		err := next.ProcessTask(ctx, t)

		if err != nil {
			logger.FromContext(ctx).Error("task_failed",
				zap.String("task_type", t.Type()),
				zap.Error(err),
			)
		} else {
			logger.FromContext(ctx).Info("task_completed",
				zap.String("task_type", t.Type()),
			)
		}

		return err
	})
}
