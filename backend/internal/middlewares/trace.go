package middlewares

import (
	"github.com/digitalcombo/sherlock-scraper/backend/internal/logger"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// TraceMiddleware gera trace_id e request_id no ponto de entrada HTTP
// e os propaga via context.Context + response headers para rastreabilidade.
func TraceMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		traceID := logger.NewTraceID()
		requestID := logger.NewTraceID()

		ctx := c.UserContext()
		ctx = logger.WithTraceID(ctx, traceID)
		ctx = logger.WithRequestID(ctx, requestID)
		c.SetUserContext(ctx)

		c.Set("X-Trace-Id", traceID)
		c.Set("X-Request-Id", requestID)

		logger.FromContext(ctx).Info("request_started",
			zap.String("method", c.Method()),
			zap.String("path", c.Path()),
			zap.Int("status", c.Response().StatusCode()),
		)

		err := c.Next()

		logger.FromContext(ctx).Info("request_completed",
			zap.String("method", c.Method()),
			zap.String("path", c.Path()),
			zap.Int("status", c.Response().StatusCode()),
		)

		return err
	}
}
