package ports

import (
	"context"
	"time"
)

// Scheduler define o contrato para agendamento de tarefas assíncronas/temporizadas.
type Scheduler interface {
	Schedule(ctx context.Context, taskType string, payload interface{}, processAt time.Time) (string, error)
	Cancel(ctx context.Context, taskID string) error
}
