# Plan: Phase 01-Segurança e Validação de Ambiente (Produção)

Este plano refina a camada de configuração para padrões de produção, garantindo segurança, imutabilidade e fail-fast limpo.

## Waves

### Wave 1: Camada de Configuração Imutável e Segura
**Task 1: Refatorar WhatsMiau (env/env.go)**
<read_first>
- `whatsmeow/env/env.go`
</read_first>
<action>
1. Tornar a struct `E` privada (mudar para `config`).
2. Tornar a variável global `Env` privada (`env`).
3. Criar uma função `Get()` que retorna a instância de configuração.
4. Ajustar `Load()`: carregar `.env` apenas se `os.Getenv("APP_ENV") != "production"`.
5. Refinar `Validate()`: usar `log.Fatal` para campos obrigatórios; `log.Printf` (Aviso) para opcionais.
</action>
<acceptance_criteria>
- Acesso à configuração via `env.Get()`.
- O sistema não entra em panic se `GEMINI_API_KEY` faltar, apenas avisa.
</acceptance_criteria>

**Task 2: Refatorar Backend (internal/config/env.go)**
<read_first>
- `backend/internal/config/env.go`
</read_first>
<action>
1. Aplicar o mesmo padrão de imutabilidade: variável `Env` privada e função `Get()`.
2. Implementar lógica de carregamento condicional do `godotenv` baseada em `APP_ENV`.
3. Validar manualmente `DATABASE_URL`, `REDIS_URL` e `JWT_SECRET`.
4. Substituir todos os `panic` por `log.Fatal` no startup.
</action>
<acceptance_criteria>
- Simetria total de padrão entre WhatsMiau e Backend.
- `APP_ENV=production` ignora o arquivo `.env`.
</acceptance_criteria>

**Task 3: Atualizar Acessos no Código**
<read_first>
- Todos os arquivos que usavam `env.Env` ou `config.Env`.
</read_first>
<action>
Substituir acessos diretos à variável global por chamadas ao getter `env.Get()` ou `config.Get()`.
</action>
<acceptance_criteria>
- O código compila sem erros de acesso a campos privados.
</acceptance_criteria>

## Verification
1. Testar startup com `APP_ENV=production` e sem `.env`, passando variáveis via shell: deve funcionar.
2. Testar startup com campo obrigatório faltando: deve encerrar com `log.Fatal` sem stack trace.
3. Verificar logs de aviso para campos opcionais ausentes.

---
**Status:** Ready for Execution
