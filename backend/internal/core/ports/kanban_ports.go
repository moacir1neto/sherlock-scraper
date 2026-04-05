package ports

import "context"

// KanbanAutomationService define o contrato para a lógica de negócio da
// automação do Kanban. Qualquer evento externo que deva mover um lead de
// estágio deve passar por este serviço — ele é o único responsável por
// conhecer as regras de transição de estado do CRM.
//
// Princípio de design (SRP): este serviço NÃO conhece WhatsApp, Redis,
// HTTP ou qualquer detalhe de infraestrutura. Ele apenas recebe dados
// normalizados e aplica regras de negócio.
type KanbanAutomationService interface {
	// O método é idempotente: se o lead já estiver em 'em_conversa' ou em
	// um estágio final (ganho/perdido), nenhuma ação é executada.
	OnWhatsAppMessageReceived(ctx context.Context, messageID string, rawPhone string) error
}

// SSEBroadcaster é a abstração que o KanbanAutomationService usa para notificar
// o frontend em tempo real após uma mudança de status.
//
// Princípio de design (DIP): o serviço de negócio depende desta abstração,
// não do sse.Hub concreto. Isso permite testes sem SSE real e troca futura
// por WebSocket ou outro mecanismo sem alterar o serviço.
type SSEBroadcaster interface {
	// Publish envia uma string de dados para todos os clientes SSE conectados.
	// Deve ser não-bloqueante: descarta o evento se nenhum cliente estiver
	// conectado ou se os buffers estiverem cheios.
	Publish(data string)
}
