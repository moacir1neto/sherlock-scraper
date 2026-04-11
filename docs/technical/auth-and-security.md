# Technical Auth and Security — Sherlock Scraper

### 1. Identificação do Documento

- **Project Name:** Sherlock Scraper
- **Project Type:** split-front-back / worker-automation
- **Project Slug:** sherlock-scraper
- **Client Name:** Moacir
- **Versão desta documentação:** 1.0
- **Última atualização:** 2026-04-10
- **Responsável pela atualização:** Orchestrator (Antigravity)

---

### 2. Resumo Geral

Atualmente, o Sherlock Scraper opera como uma ferramenta interna e administrativa. A estratégia de autenticação e autorização robusta ainda está em fase de definição para o dashboard.

**Resumo de autenticação e segurança:**  
O foco atual da segurança está na proteção de segredos (API Keys, DB Credentials) via variáveis de ambiente (.env) e isolamento de rede via Docker. A autenticação de usuário no frontend ainda não foi implementada.

**Objetivo principal da estratégia atual:**  
Garantir que credenciais sensíveis não sejam expostas no código-fonte e que o acesso aos serviços seja controlado por ambiente.

---

### 3. Estratégia de Autenticação

- **Authentication strategy:** N/A (Em definição)
- **Session strategy:** N/A
- **Role in token:** N/A
- **Refresh token:** N/A
- **Auth provider principal:** N/A

**Descrição da estratégia adotada:**  
O acesso ao dashboard e APIs é atualmente livre em ambiente local/dev. Para produção, planeja-se a implementação de JWT ou integração com o sistema de autenticação do WhatsMiau.

---

### 4. Gestão de Secrets e Variáveis

**Secrets relevantes do projeto:**  
- `POSTGRES_PASSWORD`: Senha do banco de dados.
- `REDIS_PASSWORD`: Senha do cache/fila.
- `API_KEYS`: Chaves para serviços de scraping (se houver).
- `WHATSAPP_INSTANCE_TOKEN`: Tokens para comunicação com instâncias no WhatsMiau.

**Onde secrets ficam armazenados:**  
- Arquivos `.env` (não versionados).
- Variáveis de ambiente no Docker Compose.

---

### 5. Segurança de Backend / API

**Validação de autenticação na API:**  
Atualmente não há middleware de auth global. As requisições são aceitas se provenientes da rede interna do Docker ou do host autorizado.

**Pontos sensíveis de backend:**  
- Endpoints de execução de scraping (podem ser abusados se expostos publicamente).
- Acesso direto ao PostgreSQL.

---

### 6. Segurança de Integrações Externas

**Integrações que exigem autenticação:**  
- API WhatsMiau: Exige token de instância ou JWT para disparo de mensagens.

**Como credenciais são protegidas:**  
Armazenadas exclusivamente em variáveis de ambiente no lado do servidor (backend Go/Python) e nunca expostas ao frontend.

---

### 7. Banco e Segurança de Dados

**Dados sensíveis tratados pelo sistema:**  
- Dados de leads extraídos (nomes, telefones, CNPJ).

**Regras de proteção desses dados:**  
- Acesso ao banco restrito à rede interna do Docker.
- Backup e dumps de dados devem ser criptografados.

---

### 8. Riscos e Limitações Conhecidas

**Riscos conhecidos:**  
- Exposição acidental do dashboard se publicado sem um Reverse Proxy com Auth básico (ex: Nginx with basic auth).
- Limites de rate-limit das fontes de scraping.

---

### 9. Boas Práticas Obrigatórias Neste Projeto

- Nunca versionar arquivos `.env`.
- Sempre utilizar `.env.example` para documentar variáveis necessárias.
- Validar todo dado de entrada vindo do scraper antes de persistir no banco.
- Manter as versões das bibliotecas (Python/Go) atualizadas contra vulnerabilidades conhecidas.
