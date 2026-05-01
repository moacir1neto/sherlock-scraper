# Phase Context: 01-Segurança e Validação de Ambiente (Produção)

## Domain
Saneamento de segurança e formalização de um contrato de ambiente *production-grade* com imutabilidade e comportamento determinístico em containers.

## Decisions

### 1. Contrato de Ambiente e Fail-Fast
- **Obrigatórios**: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `INTERNAL_API_TOKEN`.
- **Fail-Fast**: Uso estrito de `log.Fatal` com mensagens limpas. Proibido o uso de `panic` para erros de configuração.
- **Opcionais**: `GEMINI_API_KEY`, `GOOGLE_PLACES_API_KEY`. Se ausentes, as features dependentes são desativadas com um aviso (Warn) no log.

### 2. Imutabilidade e Acesso
- **Configuração Privada**: A struct de configuração não deve ser exportada globalmente como variável mutável.
- **Acesso**: Implementar um padrão de acesso "read-only" (Getter) ou injeção de instância para evitar condições de corrida (race conditions) ou mutações acidentais.

### 3. Carregamento de Ambiente (.env)
- **Estratégia**: `godotenv` deve ser carregado **apenas** se `APP_ENV` não for `production`.
- **Docker-Ready**: O sistema deve funcionar perfeitamente com variáveis de ambiente puras passadas pelo runtime do container.

### 4. Validação Única
- **Manual**: Validação via método `Validate()` explícito, sem depender de tags `required` da biblioteca de parse, garantindo mensagens de erro totalmente customizadas e controle total sobre o que é crítico.

## Code Context
- **WhatsMiau**: `whatsmeow/env/env.go`, `whatsmeow/main.go`.
- **Backend**: `backend/internal/config/env.go`, `backend/cmd/api/main.go`.

## Canonical Refs
- `backend/internal/config/env.go`
- `whatsmeow/env/env.go`

---
*Last updated: 2026-05-01 - Refinement for production safety*
