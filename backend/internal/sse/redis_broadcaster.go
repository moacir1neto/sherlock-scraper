package sse

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

// KanbanMovedChannel é o canal Redis Pub/Sub no qual o Sherlock publica
// eventos de movimentação de Kanban. O WhatsMeow backend assina este canal
// e retransmite os eventos para seus próprios clientes SSE.
const KanbanMovedChannel = "sherlock:leads:kanban_moved"

// RedisBroadcaster implementa ports.SSEBroadcaster publicando no Redis.
// Complementa o Hub in-memory: o Hub notifica clientes do Sherlock CRM,
// o RedisBroadcaster notifica clientes do painel WhatsMeow via Redis Pub/Sub.
type RedisBroadcaster struct {
	client *redis.Client
}

// NewRedisBroadcaster cria o broadcaster reutilizando a variável REDIS_ADDR.
func NewRedisBroadcaster() *RedisBroadcaster {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}

	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		DialTimeout:  5 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	log.Printf("[RedisBroadcaster] 📡 Cliente configurado em %q (canal: %s)", addr, KanbanMovedChannel)
	return &RedisBroadcaster{client: client}
}

// Publish serializa e publica o payload no canal Redis.
// Implementa ports.SSEBroadcaster — chamado pelo KanbanAutomationService.
func (r *RedisBroadcaster) Publish(data string) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := r.client.Publish(ctx, KanbanMovedChannel, data).Err(); err != nil {
		log.Printf("[RedisBroadcaster] ⚠️  Falha ao publicar no canal %q: %v", KanbanMovedChannel, err)
	}
}
