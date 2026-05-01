# Plan: Phase 01-Segurança e Validação de Ambiente

Este plano formaliza um contrato de ambiente (Environment Contract) *production-grade*, implementando uma camada centralizada de validação estrita com comportamento *fail-fast*.

## Waves

### Wave 1: Centralized Env Validation Layer
**Task 1: Camada de Configuração em WhatsMiau**
<read_first>
- `whatsmeow/env/env.go`
- `whatsmeow/main.go`
</read_first>
<action>
1. Refatorar/criar `whatsmeow/env/env.go` para usar uma `struct Config` explícita que mantenha as variáveis do serviço.
2. Mapear `DATABASE_URL`, `REDIS_URL`, `INTERNAL_API_TOKEN` e `JWT_SECRET` como campos obrigatórios. `GEMINI_API_KEY` e `GOOGLE_PLACES_API_KEY` são opcionais.
3. Implementar um método `Validate()` na `struct Config` que retorna um erro descritivo se as variáveis obrigatórias estiverem ausentes.
4. Implementar a função `Load()` para popular a struct, e logo em seguida chamar `Validate()`.
5. No `whatsmeow/main.go`, chamar `env.Load()` e abortar a inicialização com `log.Fatal` (ou `panic`) se retornar erro.
</action>
<acceptance_criteria>
- Variáveis são acessadas apenas via struct `env.Config`.
- O serviço aborta no startup com erro claro se qualquer variável obrigatória estiver vazia.
</acceptance_criteria>

**Task 2: Camada de Configuração em Sherlock (Backend)**
<read_first>
- `backend/cmd/api/main.go`
- `backend/internal/middlewares/auth_middleware.go`
</read_first>
<action>
1. Criar o pacote `backend/internal/config` (ex: `env.go`).
2. Implementar o exato mesmo padrão usado no WhatsMiau: `struct Config`, método `Load()` e método `Validate()`.
3. Mapear `DATABASE_URL`, `REDIS_URL` e `JWT_SECRET` como campos obrigatórios.
4. No `backend/cmd/api/main.go`, chamar o carregamento e validação, usando `log.Fatal` em caso de erro.
5. Em todo o backend (ex: middlewares e conexões de DB/Redis), substituir acessos diretos como `os.Getenv` pelo uso da struct global de configuração.
</action>
<acceptance_criteria>
- Acesso centralizado via struct `config.Env` (ou similar) padronizado.
- O serviço aborta no startup se variáveis obrigatórias estiverem vazias.
- Não há ocorrências de `os.Getenv` espalhadas pela lógica de negócio.
</acceptance_criteria>

**Task 3: Saneamento e Remoção de Fallbacks**
<read_first>
- `backend/internal/middlewares/auth_middleware.go`
</read_first>
<action>
1. Auditar o código para remover variáveis default *hardcoded* (ex: "super_secret_key_change_in_production").
2. Remover verificações inline como `if env == "" { useDefault() }` para configurações que agora são estritamente obrigatórias.
</action>
<acceptance_criteria>
- Nenhuma string de fallback insegura existe no repositório.
- A segurança é garantida pela presença das variáveis no ambiente validado no startup.
</acceptance_criteria>

## Verification
1. Rodar `docker compose up` após limpar o arquivo `.env`. Ambos os serviços devem falhar imediatamente e exibir mensagens de erro da função `Validate()`.
2. Verificar no código que o padrão `Load() -> Validate()` está implementado em ambos os serviços de forma simétrica.

---
**Status:** Ready for Execution
