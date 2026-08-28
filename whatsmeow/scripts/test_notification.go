package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
)

func main() {
	rdb := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	ctx := context.Background()

	// Simula payload que o Sherlock enviaria
	payload := map[string]interface{}{
		"company_id":   "00000000-0000-0000-0000-000000000001",
		"lead_id":      "some-lead-uuid", // Você precisa de um lead ID real no seu banco para testar o envio
		"lead_name":    "Cliente Teste",
		"type":         "MEETING_SCHEDULED",
		"scheduled_at": "10 de Maio às 15:00",
		"trace_id":     uuid.New().String(),
	}

	data, _ := json.Marshal(payload)

	err := rdb.Publish(ctx, "sherlock:notifications", data).Err()
	if err != nil {
		log.Fatalf("Erro ao publicar: %v", err)
	}

	fmt.Printf("Notificação enviada com sucesso! TraceID: %s\n", payload["trace_id"])
}
