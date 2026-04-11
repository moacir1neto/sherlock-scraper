# Technical Infra and Deploy — Sherlock Scraper

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

O Sherlock Scraper é uma aplicação containerizada distribuída em múltiplos serviços, utilizando Docker Compose para orquestração local e simplificação do deploy em VPS.

**Resumo de infra e deploy:**  
A aplicação é composta por containers para o Frontend (React), Backend (Go), Whatsmeow (Go) e Scrapers (Python), além de serviços de banco (PostgreSQL) e cache (Redis). O deploy é atualmente manual via Docker Compose em servidor VPS.

**Objetivo principal da estratégia atual:**  
Manter a portabilidade total do ecossistema e facilitar a replicação do ambiente de desenvolvimento para produção.

---

### 3. Estratégia de Hospedagem

- **Hosting strategy:** docker-vps
- **Deploy provider:** manual (direto na VPS) / Dokploy (candidato)
- **Deploy mode:** manual
- **Container strategy:** docker-compose (multi-container)

---

### 4. Estrutura de Containers e Serviços

**Serviços principais:**  
- `frontend`: Dashboard Vite/React.
- `backend`: API de orquestração em Go.
- `whatsmeow`: Módulo de integração WhatsApp Go.
- `scrapers`: Motores Python para Google/CNPJ.

**Serviços auxiliares:**  
- `db`: PostgreSQL.
- `redis`: Redis para filas e sessões.

---

### 5. Docker e Imagens

**Usa Docker?** Sim.

**Arquivos de configuração:**  
- `docker-compose.yml`: Define a rede e os volumes compartilhados.
- `Dockerfile` (raiz): Para o ambiente Python/Scrapers.
- `frontend/Dockerfile`: Build multi-stage para o dashboard.
- `backend/Dockerfile`: Build multi-stage para a API Go.
- `whatsmeow/Dockerfile`: Build para o serviço de mensageria.

---

### 6. Fluxo de Deploy Atual

**Processo manual:**  
1. Acessar a VPS via SSH.
2. Clonar/Atualizar o repositório na pasta `/home/moadev/projetos/sherlock-scraper`.
3. Executar `docker compose up -d --build`.
4. Verificar logs com `docker compose logs -f`.

---

### 7. Variáveis de Ambiente e Secrets

**Principais locais de gestão:**  
- Arquivos `.env` na raiz de cada serviço.
- Variáveis passadas no `docker-compose.yml`.

**Variáveis críticas:**  
- `DB_URL`, `REDIS_URL`, `WHATSAPP_API_TOKEN`.

---

### 8. Observabilidade e Logs

**Consulta de logs:**  
- Via comando `docker logs <container_name>`.
- Logs persistidos em volume Docker quando configurado.

---

### 9. Riscos e Limitações Atuais

**Riscos conhecidos:**  
- Downtime durante o build e restart dos containers (sem blue/green deploy).
- Dependência de acesso direto via SSH para deploy.

**Evoluções futuras:**  
- Implementar pipeline CI/CD via GitHub Actions.
- Automatizar o deploy via Dokploy ou Portainer.
