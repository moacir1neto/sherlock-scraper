package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/digitalcombo/sherlock-scraper/backend/internal/config"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"
	"github.com/digitalcombo/sherlock-scraper/backend/internal/logger"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// WhatsAppMessagesChannel é o canal Redis Pub/Sub no qual o WhatsMeow publica
// eventos de mensagens recebidas. O mesmo nome DEVE ser usado pelo publisher
// (Fase 2 — módulo WhatsMeow).
const WhatsAppMessagesChannel = "whatsapp:messages:received"

// WhatsAppMessageEvent é o contrato do payload publicado pelo WhatsMeow.
// O publisher (Fase 2) deve serializar exatamente este JSON.
//
// Campo Phone: número em dígitos apenas (sem formatação), com DDI se possível.
// Exemplo: "5548999999999". O KanbanAutomationService cuida da normalização
// e geração de variantes — o publisher não precisa fazer isso.
type WhatsAppMessageEvent struct {
	MessageID  string    `json:"message_id"`  // ID único da mensagem (idempotência)
	Phone      string    `json:"phone"`       // Ex: "5548999999999"
	InstanceID string    `json:"instance_id"` // ID da instância WhatsMeow que recebeu
	ReceivedAt time.Time `json:"received_at"` // Timestamp do recebimento
}

// RedisSubscriber escuta o canal Redis Pub/Sub e aciona o KanbanAutomationService
// para cada mensagem recebida.
//
// Responsabilidade única (SRP): este struct apenas:
//   - Conecta ao Redis
//   - Lê e deserializa payloads
//   - Delega a lógica de negócio ao KanbanAutomationService
//
// Ele NÃO conhece leads, telefones, GORM ou regras de Kanban.
type RedisSubscriber struct {
	client  *redis.Client
	service ports.KanbanAutomationService
}

// NewRedisSubscriber cria o subscriber reutilizando a variável de ambiente
// REDIS_ADDR já utilizada pelo restante do sistema (queue/client.go).
// Se a variável não estiver definida, usa "localhost:6379" como fallback.
func NewRedisSubscriber(service ports.KanbanAutomationService) *RedisSubscriber {
	addr := config.Get().RedisURL
	if addr == "" {
		addr = "localhost:6379"
	}

	client := redis.NewClient(&redis.Options{
		Addr: addr,
		// DialTimeout e ReadTimeout evitam que o subscriber fique pendurado
		// em caso de falha de rede sem retornar erro.
		DialTimeout:  5 * time.Second,
		ReadTimeout:  0, // 0 = sem timeout de leitura (necessário para Pub/Sub blocking)
		WriteTimeout: 3 * time.Second,
	})

	logger.Get().Info("redis_subscriber_configurado", zap.String("addr", addr))
	return &RedisSubscriber{client: client, service: service}
}

// Listen inicia o loop de escuta e reconexão automática.
// Deve ser chamado em uma goroutine separada (via `go subscriber.Listen(ctx)`).
//
// O loop implementa backoff exponencial: começa em 1s e dobra a cada falha,
// até o máximo de 30s. Ao receber cancelamento do contexto, encerra limpo.
func (s *RedisSubscriber) Listen(ctx context.Context) {
	logger.FromContext(ctx).Info("iniciando_listener_redis_subscriber", zap.String("channel", WhatsAppMessagesChannel))

	backoff := time.Second
	const maxBackoff = 30 * time.Second

	for {
		if err := s.subscribe(ctx); err != nil {
			if ctx.Err() != nil {
				// Contexto cancelado — shutdown limpo, sem log de erro
				logger.FromContext(ctx).Info("redis_subscriber_encerrado_contexto_cancelado")
				return
			}
			logger.FromContext(ctx).Warn("erro_subscricao_redis", zap.Error(err), zap.Duration("backoff", backoff))
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				logger.FromContext(ctx).Info("redis_subscriber_encerrado_durante_backoff")
				return
			}
			// Backoff exponencial até o teto
			if backoff < maxBackoff {
				backoff *= 2
			}
			continue
		}
		// subscribe retornou nil → canal fechou sem erro (ex: UNSUBSCRIBE do server)
		// Reseta o backoff e reconecta imediatamente
		backoff = time.Second
	}
}

// subscribe executa um ciclo de subscrição usando ReceiveMessage — a API
// explícita do go-redis que retorna apenas mensagens de dados reais,
// sem conflito com goroutines internas do Channel().
//
// Por que não usar pubsub.Channel()?
//
//	Channel() inicia uma goroutine interna que concorre com qualquer
//	Receive() chamado manualmente — a mensagem pode ser consumida pela
//	goroutine interna sem chegar ao nosso select. ReceiveMessage() elimina
//	essa ambiguidade ao usar uma única path de leitura bloqueante.
func (s *RedisSubscriber) subscribe(ctx context.Context) error {
	pubsub := s.client.Subscribe(ctx, WhatsAppMessagesChannel)
	defer func() {
		if err := pubsub.Close(); err != nil {
			logger.FromContext(ctx).Warn("erro_fechar_pubsub", zap.Error(err))
		}
	}()

	// Aguarda a confirmação de subscrição do Redis (mensagem do tipo *redis.Subscription)
	// antes de entrar no loop de mensagens.
	if _, err := pubsub.Receive(ctx); err != nil {
		return fmt.Errorf("erro ao confirmar subscrição: %w", err)
	}

	logger.FromContext(ctx).Info("subscricao_redis_ativa", zap.String("channel", WhatsAppMessagesChannel))

	// Loop bloqueante: ReceiveMessage() retorna apenas mensagens de dados reais.
	// Ignora pings internos e confirmações — nenhuma goroutine concorrente.
	for {
		msg, err := pubsub.ReceiveMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return nil // contexto cancelado — shutdown limpo
			}
			// Erro de rede/timeout — sinaliza para o loop externo reconectar
			return fmt.Errorf("erro ao receber mensagem: %w", err)
		}
		s.handleMessage(ctx, msg.Payload)
	}
}

// handleMessage deserializa e processa um único evento do Pub/Sub.
// Erros de parse são logados e descartados (não param o subscriber).
// Erros do serviço são logados mas não causam reconexão.
func (s *RedisSubscriber) handleMessage(ctx context.Context, payload string) {
	// Cada mensagem recebida via Pub/Sub inicia uma nova "transação" de log
	traceID := logger.NewTraceID()
	ctx = logger.WithTraceID(ctx, traceID)
	l := logger.FromContext(ctx)

	l.Debug("evento_redis_recebido", zap.String("payload", payload))

	var event WhatsAppMessageEvent
	if err := json.Unmarshal([]byte(payload), &event); err != nil {
		l.Error("falha_desserializar_payload_redis", zap.Error(err), zap.String("raw", payload))
		return
	}

	if event.Phone == "" {
		l.Warn("evento_redis_sem_telefone", zap.String("raw", payload))
		return
	}

	ctx = logger.WithLeadID(ctx, event.Phone) // Aqui o Phone funciona como um ID temporário ou busca
	l.Info("despachando_mensagem_whatsapp_automacao",
		zap.String("phone", event.Phone),
		zap.String("instance_id", event.InstanceID),
		zap.String("msg_id", event.MessageID),
	)

	// Contexto com timeout para não bloquear o loop de eventos caso o DB leve
	// mais de 5 segundos (ex: connection pool esgotado)
	callCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := s.service.OnWhatsAppMessageReceived(callCtx, event.MessageID, event.Phone); err != nil {
		l.Error("kanban_automation_erro",
			zap.String("phone", event.Phone),
			zap.Error(err),
		)
		// Não retorna o erro — um lead não encontrado não deve parar o subscriber
	}
}
