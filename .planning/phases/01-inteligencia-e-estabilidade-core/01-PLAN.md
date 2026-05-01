# Plan: Phase 01-Inteligência e Estabilidade Core

Este plano visa fortalecer a base do sistema, garantindo segurança no startup, resiliência na comunicação com IA e cobertura de testes na lógica de automação de vendas.

## Waves

### Wave 1: Segurança e Startup (Enforcement)
Foco em garantir que o sistema nunca opere em estado inseguro.

**Task 1: Validar variáveis críticas no startup**
<read_first>
- `whatsmeow/main.go`
- `backend/cmd/api/main.go`
- `whatsmeow/env/env.go` (ou arquivo de config de env)
</read_first>
<action>
1. No pacote de ambiente (`env`), criar uma função `ValidateCritical()` que verifica a presença de `JWT_SECRET`, `INTERNAL_API_TOKEN` e `DATABASE_URL`.
2. Em `whatsmeow/main.go` e `backend/cmd/api/main.go`, chamar esta validação logo após carregar as envs.
3. Se faltar variável, usar `log.Fatal` ou `panic` com mensagem clara do que está faltando.
</action>
<acceptance_criteria>
- Ao rodar o serviço sem `JWT_SECRET` no `.env`, o processo deve encerrar imediatamente com erro.
- Logs indicam exatamente qual variável está faltando.
</acceptance_criteria>

**Task 2: Remover fallbacks de segurança**
<read_first>
- `backend/internal/middlewares/auth_middleware.go`
</read_first>
<action>
Remover a atribuição de fallback para a variável `secret` na linha 14: `secret = "super_secret_key_change_in_production"`. Se a env for vazia, a assinatura do JWT deve falhar ou o sistema já deve ter parado no startup.
</action>
<acceptance_criteria>
- String "super_secret_key_change_in_production" não existe mais no codebase.
</acceptance_criteria>

### Wave 2: Estabilidade Kanban (Testes Unitários)
Foco em garantir que leads não "pulem" status indevidamente.

**Task 3: Migração de flag ai_failed**
<read_first>
- `whatsmeow/services/migrations.go` (ou onde as migrações SQL residem)
</read_first>
<action>
Adicionar a coluna `ai_failed` (boolean, default false) na tabela `leads` para permitir rastreamento de falhas do agente.
</action>
<acceptance_criteria>
- Tabela `leads` possui a coluna `ai_failed`.
</acceptance_criteria>

**Task 4: Implementar Testes Unitários Kanban**
<read_first>
- `whatsmeow/services/kanban_automation.go`
</read_first>
<action>
1. Criar `whatsmeow/services/kanban_automation_test.go`.
2. Implementar structs de Mock para `LeadRepository`, `InstanceRepository` e `ChatBroadcaster`.
3. Adicionar casos de teste para:
    - Mensagem de entrada move lead para "em_conversa" (se status permitir).
    - Mensagem de saída move lead para "contatado" (se status permitir).
    - Idempotência: Se o lead já estiver em status final (ex: ganho), não deve ser movido.
</action>
<acceptance_criteria>
- `go test -v ./whatsmeow/services/kanban_automation_test.go` passa com sucesso.
</acceptance_criteria>

### Wave 3: Resiliência AI Agent
Foco em reduzir falhas de processamento por instabilidade do Gemini.

**Task 5: Implementar Retry no callGemini**
<read_first>
- `whatsmeow/services/sales_agent.go`
</read_first>
<action>
1. No método `callGemini`, envolver o bloco de requisição HTTP e unmarshal em um loop de 2 tentativas (1 original + 1 retry).
2. Adicionar um delay de 500ms entre as tentativas em caso de erro 5xx ou JSON inválido.
3. Logar cada tentativa falha para auditoria.
</action>
<acceptance_criteria>
- Em caso de timeout ou erro transiente do Gemini, o sistema tenta uma segunda vez antes de desistir.
</acceptance_criteria>

**Task 6: Fail-safe Handoff em erros de IA**
<read_first>
- `whatsmeow/services/sales_agent.go`
</read_first>
<action>
1. Se `callAI` (que tenta Gemini e Groq) retornar erro após retries, o sistema deve:
    - Marcar o lead com `ai_failed = true`.
    - Pausar a IA no chat (`pauseChat`).
    - Emitir o evento de handoff humano via `handoffHub.PublishHandoff`.
2. Garantir que nenhuma mensagem errática seja enviada ao lead.
</action>
<acceptance_criteria>
- Leads com falha de IA são pausados e aparecem no alerta de handoff humano.
</acceptance_criteria>

### Wave 4: Handoff Híbrido (Sentimento)
Foco em sensibilidade humana imediata.

**Task 7: Blacklist de Palavras-chave Locais**
<read_first>
- `whatsmeow/services/sales_agent.go`
</read_first>
<action>
1. Definir uma lista de strings de interrupção em `sales_agent.go`: `["reclamação", "procon", "processo", "cancelar", "quero falar com humano", "falar com pessoa"]`.
2. Em `ProcessIncoming`, antes de chamar a IA, verificar se a mensagem do lead contém algum desses termos (case-insensitive).
3. Se contiver, forçar `agentResp.AcionarHumano = true` e pular a chamada da IA se possível, ou processar como handoff imediato.
</action>
<acceptance_criteria>
- Mensagem "Vou reclamar no PROCON" pausa a IA e aciona handoff sem intervenção do Gemini.
</acceptance_criteria>

## Verification
1. Executar testes unitários do Kanban.
2. Validar startup sem variáveis de ambiente críticas.
3. Testar envio de palavras da blacklist via WhatsApp e verificar pausa automática.

---
**Status:** Ready for Execution (YOLO Mode)
