# Phase Research: 01-Inteligência e Estabilidade Core (Refined)

## 1. Mensageria e Filas (Asynq)
- **Localização**: `backend/internal/queue/server.go` e `tasks.go`.
- **Estratégia de Retry**: Ajustar `asynq.MaxRetry(5)` com `RetryDelayFunc` para implementar backoff exponencial customizado.
- **Idempotência**: Utilizar o `TaskID` no momento do `Enqueue`. Ex: `asynq.TaskID(fmt.Sprintf("enrich:%s", leadID))`. O Asynq descarta automaticamente duplicatas com o mesmo ID em um intervalo de tempo.
- **Failure Handling**: Implementar `ErrorHandler` na configuração do `asynq.Config` para capturar erros e enriquecê-los com metadados antes de logar.

## 2. Gestão de Ambiente (Environment)
- **Tooling**: Utilizar o pacote nativo `os` ou `github.com/joho/godotenv`.
- **Estratégia**: Criar uma struct `Config` em cada serviço com tags de obrigatoriedade. Implementar um método `Validate()` que percorre as chaves críticas e aborta o startup com `zap.S().Fatal` se houver ausência.

## 3. Migrações de Banco de Dados
- **Ferramenta**: **`golang-migrate`**.
- **Setup**:
    - Criar diretório `/migrations` na raiz ou dentro de cada serviço.
    - Criar script `migrate.go` ou usar a CLI via Makefile para rodar `up` no startup.
    - Converter `whatsmeow/services/migrations.go` (SQL inline) para arquivos `.sql`.

## 4. Observabilidade (Structured Logging)
- **Zap Configuration**: Configurar `zap.NewProductionEncoderConfig()` para garantir output JSON.
- **Context Injection**: Criar um middleware ou helper para injetar `trace_id` (UUID) no context e garantir que o logger o extraia em cada chamada.

## 5. Resiliência AI
- **Retry**: Loop de 1 retry em `callGemini`.
- **Blacklist**: Verificação de strings críticas antes da chamada à API para evitar custos e latência em casos de interrupção óbvia.

## Validation Architecture (Nyquist)
- **Dimensão 7 (Segurança)**: Validação estrita de envs impede exposição de chaves padrão.
- **Dimensão 8 (Monitoramento)**: Logs JSON permitem integração com stack ELK/Loki.
- **Dimensão 9 (Resiliência)**: Retries no Asynq e AI garantem que falhas transientes não interrompam o fluxo do usuário.

---
*Research refined for production-grade stability.*
