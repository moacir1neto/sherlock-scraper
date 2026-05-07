# Spec da Fase 2: Infraestrutura e Resiliência

## 🎯 Objetivo
Fortalecer a base operacional do sistema através de padrões de resiliência de nível de produção, garantindo estabilidade, observabilidade e proteção de recursos externos.

## 🏗️ Escopo

### 1. Resiliência e Filas (Asynq)
- **Exponential Backoff:** Estratégia de retry progressiva para falhas temporárias.
- **Idempotência (TaskID):** Garantir que o re-processamento de uma tarefa não gere efeitos colaterais duplicados.
- **Dead Letter Queue (DLQ):** Tarefas que excederem o limite de retries devem ser movidas para uma fila de inspeção manual/reprocessamento posterior.
- **Circuit Breaker:** Implementar disjuntores para chamadas a serviços externos (Gemini, WhatsApp, Scrapers) para evitar cascata de erros se o serviço estiver indisponível.

### 2. Controle de Recursos e Scraper
- **Scraper Hardening:** Rotação dinâmica de Headers e User-Agents.
- **Rate Limiting:** Controle de frequência de requisições configurável por alvo (ex: Google Maps vs sites genéricos) para evitar bloqueios.
- **Timeout Control:** Definição rigorosa de timeouts para requisições HTTP, chamadas de IA e processamento de filas, evitando goroutines "penduradas".

### 3. Observabilidade e Diagnóstico
- **Structured Logging (Zap):** Implementação robusta de logs estruturados em JSON.
- **Logging Context:** Injeção obrigatória de contexto nos logs: `task_id`, `lead_id`, `company_id` e `trace_id`.
- **Queue Visibility:** Monitoramento básico do estado das filas e latência de processamento.

## ✅ Critérios de Aceitação (UAT)
- [ ] Tarefas que falham repetidamente são movidas automaticamente para a DLQ após o limite de retries.
- [ ] O Circuit Breaker deve "abrir" após uma taxa de falha configurável em chamadas de IA, retornando erro imediato sem onerar o sistema.
- [ ] O Scraper deve respeitar limites de requisições por minuto definidos via configuração.
- [ ] Toda requisição externa deve ter um contexto de timeout explícito; nenhuma tarefa deve durar indefinidamente.
- [ ] Logs devem permitir rastreabilidade total através de múltiplas tarefas usando o `lead_id` e o `trace_id` gerado no ponto de entrada.

## ⚠️ Fora de Escopo
- Geração de dossiês via IA (Fase 3).
- Melhorias no prompt do agente de vendas (Fase 3).
- Implementação de métricas (Prometheus/Grafana) — focar apenas em Logs estruturados e Filas nesta fase.
