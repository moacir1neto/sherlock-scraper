package scheduler

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hibiken/asynq"
	"go.uber.org/zap"
)

// Scheduler define a interface para agendamento de tarefas temporizadas.
type Scheduler interface {
	Schedule(ctx context.Context, taskType string, payload interface{}, processAt time.Time) (string, error)
	Cancel(ctx context.Context, taskID string) error
}

// asynqScheduler implementa o Scheduler usando Asynq (Redis).
type asynqScheduler struct {
	client    *asynq.Client
	inspector *asynq.Inspector
}

// NewAsynqScheduler cria uma nova instância do agendador Asynq usando clientes existentes.
func NewAsynqScheduler(client *asynq.Client, inspector *asynq.Inspector) Scheduler {
	return &asynqScheduler{
		client:    client,
		inspector: inspector,
	}
}

// Schedule enfileira uma tarefa para ser processada em um momento específico.
func (s *asynqScheduler) Schedule(ctx context.Context, taskType string, payload interface{}, processAt time.Time) (string, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal task payload: %w", err)
	}

	task := asynq.NewTask(taskType, data)
	
	// Enfileira com delay
	info, err := s.client.EnqueueContext(ctx, task, asynq.ProcessAt(processAt))
	if err != nil {
		return "", fmt.Errorf("failed to enqueue task: %w", err)
	}

	zap.L().Info("task scheduled successfully",
		zap.String("task_id", info.ID),
		zap.String("type", taskType),
		zap.Time("process_at", processAt))

	return info.ID, nil
}

// Cancel remove uma tarefa agendada da fila se ela ainda não foi processada.
func (s *asynqScheduler) Cancel(ctx context.Context, taskID string) error {
	// No Asynq, para cancelar uma tarefa você precisa saber a fila (padrão "default")
	err := s.inspector.DeleteTask("default", taskID)
	if err != nil {
		zap.L().Warn("failed to cancel task", zap.String("task_id", taskID), zap.Error(err))
		return err
	}

	zap.L().Info("task canceled successfully", zap.String("task_id", taskID))
	return nil
}
