# Plano de Implementação: Fase 2 - Infraestrutura e Resiliência

Este plano divide a implementação em ondas sequenciais para garantir segurança e testabilidade em cada etapa.

## 🌊 Onda 1: Observabilidade (Logging & Contexto) ✅
Foco em dar visibilidade ao que acontece dentro dos workers e APIs através de rastreabilidade ponta-a-ponta.

- [x] **Configuração do Zap:** Implementar logger estruturado centralizado no backend.
- [x] **Geração de Correlation IDs:** Criar middleware para gerar `trace_id` / `request_id` nos pontos de entrada (HTTP).
- [x] **Logger com Context Aware:** Criar helper do logger que extrai automaticamente metadados (`trace_id`, `task_id`, `lead_id`, `company_id`) do `context.Context`.
- [x] **Propagação Progressiva de Contexto:** 
    - Injetar `context.Context` nos Handlers HTTP.
    - Passar contexto para Camada de Serviços.
    - Propagar contexto para Enfileiramento (Asynq Payload) e Workers.
- [x] **Estratégia de Intrusão Mínima:** Introduzir as mudanças de assinatura de funções de forma incremental para evitar quebras em massa.

## 🌊 Onda 2: Padronização HTTP & Timeouts
Centralizar a saída de rede para evitar goroutines travadas.

- [ ] **Central HTTP Client:** Criar um cliente HTTP padronizado com timeouts globais e específicos por serviço.
- [ ] **Refatoração do Scraper:** Substituir chamadas HTTP diretas pelo cliente padronizado.
- [ ] **Timeouts em Chamadas de IA:** Aplicar timeouts rigorosos nas integrações com Gemini/OpenAI.

## 🌊 Onda 3: Confiabilidade de Filas (Retry & Idempotência)
Garantir que falhas temporárias sejam tratadas e tarefas não dupliquem.

- [ ] **Exponential Backoff:** Configurar a estratégia de retry no Asynq para falhas de rede.
- [ ] **Lógica de Idempotência:** Implementar verificação de `TaskID` antes de iniciar processamentos pesados (ex: scraping).

## 🌊 Onda 4: Circuit Breaker
Proteção contra degradação de serviços externos.

- [ ] **Implementação do Circuit Breaker:** Usar `sony/gobreaker` ou equivalente para proteger as pontes de integração (Gemini, WhatsApp, Google Maps).
- [ ] **Fallbacks Básicos:** Definir comportamento do sistema quando o circuito estiver aberto (ex: retornar erro amigável "Serviço Temporariamente Indisponível").

## 🌊 Onda 5: Rate Limiting
Prevenção de bloqueios por excesso de requisições.

- [ ] **Limiter por Alvo:** Implementar rate limiting configurável para o Scraper (ex: 5 req/min para sites genéricos).
- [ ] **Tratamento de 429/403:** Lógica para respeitar headers de `Retry-After`.

## 🌊 Onda 6: Dead Letter Queue (DLQ)
Isolamento de falhas persistentes.

- [ ] **Configuração de DLQ:** Configurar o Asynq para mover tarefas que excederam o limite de retries para uma fila dedicada.
- [ ] **Endpoint de Inspeção:** Criar uma rota (interna ou de admin) para listar tarefas na DLQ para auditoria.

## 🛠️ Validação e Testes
- **Testes de Integração:** Simular falhas de rede para validar retry e circuit breaker.
- **Log Audit:** Verificar se os logs JSON contêm todos os campos de contexto exigidos.
- **Load Test Simples:** Validar se o rate limiting bloqueia requisições excedentes.
