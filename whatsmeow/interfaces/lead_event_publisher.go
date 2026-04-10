package interfaces

import "golang.org/x/net/context"

// LeadEventPublisher define o contrato para publicar eventos de mensagens
// recebidas do WhatsApp para sistemas externos (ex: Sherlock CRM).
//
// Princípio de design (SRP / Inversão de Dependência):
//   - O ChatWorker depende desta abstração, não de Redis ou HTTP diretamente.
//   - O WhatsMeow não sabe nada sobre Kanban, Leads ou regras de CRM.
//     Ele apenas declara: "recebi uma mensagem deste número nesta instância".
//   - Qualquer implementação pode ser trocada (Redis, HTTP, SQS) sem tocar
//     no ChatWorker.
type LeadEventPublisher interface {
	// PublishIncomingMessage notifica que uma mensagem RECEBIDA (não enviada
	// pelo próprio usuário) chegou do número phone na instância instanceID.
	//
	// phone deve ser o número em dígitos com DDI, extraído do JID do WhatsApp.
	// Ex: "5548999999999" (JID original: "5548999999999@s.whatsapp.net").
	//
	// Implementações devem ser não-bloqueantes: usar timeout interno e nunca
	// retornar um erro que pare o fluxo principal de persistência de mensagens.
	PublishIncomingMessage(ctx context.Context, messageID string, phone string, instanceID string) error
}
