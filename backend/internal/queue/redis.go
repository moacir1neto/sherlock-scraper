// Package queue expõe um client go-redis para que os workers publiquem
// eventos de progresso em canais Redis Pub/Sub (campaigns:logs:<id>).
//
// O client é inicializado junto ao Asynq client em InitClient() e
// reutiliza a mesma variável REDIS_ADDR do restante do sistema.
package queue

import (
	"context"
	"log"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/config"
	"github.com/redis/go-redis/v9"
)

// RedisPublisher é o client go-redis usado exclusivamente para Publish.
// Separado do Asynq client para não misturar responsabilidades.
var RedisPublisher *redis.Client

// CampaignLogChannel retorna o nome do canal Redis para uma campanha.
func CampaignLogChannel(campaignID string) string {
	return "campaigns:logs:" + campaignID
}

// DossierLogChannel retorna o nome do canal Redis para o pipeline de dossier de um lead.
// Cada lead tem canal exclusivo: dossier:logs:<lead_id>
func DossierLogChannel(leadID string) string {
	return "dossier:logs:" + leadID
}

// PublishDossierEvent publica um payload JSON no canal de dossier do lead.
// Usa timeout curto de 2s para não bloquear o worker em caso de falha Redis.
func PublishDossierEvent(leadID, payload string) {
	if RedisPublisher == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := RedisPublisher.Publish(ctx, DossierLogChannel(leadID), payload).Err(); err != nil {
		log.Printf("[Queue] ⚠️  Falha ao publicar evento dossier (lead=%s): %v", leadID, err)
	}
}

// InitRedisPublisher cria o client go-redis reutilizando REDIS_ADDR.
// Deve ser chamado em main.go logo após InitClient().
func InitRedisPublisher() {
	addr := config.Get().RedisURL
	if addr == "" {
		addr = "localhost:6379"
	}

	RedisPublisher = redis.NewClient(&redis.Options{
		Addr:         addr,
		DialTimeout:  5 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	log.Printf("[Queue] 📡 Redis publisher configurado em %q", addr)
}

// PublishCampaignEvent publica um payload JSON no canal da campanha.
// Usa timeout curto de 2s para não bloquear o worker em caso de falha Redis.
func PublishCampaignEvent(campaignID, payload string) {
	if RedisPublisher == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := RedisPublisher.Publish(ctx, CampaignLogChannel(campaignID), payload).Err(); err != nil {
		log.Printf("[Queue] ⚠️  Falha ao publicar evento (campaign=%s): %v", campaignID, err)
	}
}
