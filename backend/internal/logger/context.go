package logger

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

type contextKey string

const (
	traceIDKey   contextKey = "trace_id"
	requestIDKey contextKey = "request_id"
	taskIDKey    contextKey = "task_id"
	leadIDKey    contextKey = "lead_id"
	companyIDKey contextKey = "company_id"
)

// WithTraceID injeta um trace_id no contexto.
func WithTraceID(ctx context.Context, traceID string) context.Context {
	return context.WithValue(ctx, traceIDKey, traceID)
}

// WithRequestID injeta um request_id no contexto.
func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, requestIDKey, requestID)
}

// WithTaskID injeta um task_id no contexto.
func WithTaskID(ctx context.Context, taskID string) context.Context {
	return context.WithValue(ctx, taskIDKey, taskID)
}

// WithLeadID injeta um lead_id no contexto.
func WithLeadID(ctx context.Context, leadID string) context.Context {
	return context.WithValue(ctx, leadIDKey, leadID)
}

// WithCompanyID injeta um company_id no contexto.
func WithCompanyID(ctx context.Context, companyID string) context.Context {
	return context.WithValue(ctx, companyIDKey, companyID)
}

// NewTraceID gera um novo UUID v4 para uso como trace_id.
func NewTraceID() string {
	return uuid.New().String()
}

// TraceIDFrom extrai o trace_id do contexto, ou string vazia se ausente.
func TraceIDFrom(ctx context.Context) string {
	if v, ok := ctx.Value(traceIDKey).(string); ok {
		return v
	}
	return ""
}

// ExtractFields extrai todos os campos de rastreio do contexto e retorna
// como zap.Field slice para inclusão automática nos logs.
func ExtractFields(ctx context.Context) []zap.Field {
	fields := make([]zap.Field, 0, 5)

	if v, ok := ctx.Value(traceIDKey).(string); ok && v != "" {
		fields = append(fields, zap.String("trace_id", v))
	}
	if v, ok := ctx.Value(requestIDKey).(string); ok && v != "" {
		fields = append(fields, zap.String("request_id", v))
	}
	if v, ok := ctx.Value(taskIDKey).(string); ok && v != "" {
		fields = append(fields, zap.String("task_id", v))
	}
	if v, ok := ctx.Value(leadIDKey).(string); ok && v != "" {
		fields = append(fields, zap.String("lead_id", v))
	}
	if v, ok := ctx.Value(companyIDKey).(string); ok && v != "" {
		fields = append(fields, zap.String("company_id", v))
	}

	return fields
}

// FromContext retorna um logger filho com todos os campos de rastreio do contexto
// já embutidos. Uso idiomático: logger.FromContext(ctx).Info("mensagem")
func FromContext(ctx context.Context) *zap.Logger {
	return Get().With(ExtractFields(ctx)...)
}

// Ctx retorna um logger filho com todos os campos de rastreio do contexto
// já embutidos. Alias para FromContext mantido para compatibilidade.
func Ctx(ctx context.Context) *zap.Logger {
	return FromContext(ctx)
}
