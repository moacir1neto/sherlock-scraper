# Technical Architecture — Sherlock Scraper

### 1. Identificação do Documento

- **Project Name:** Sherlock Scraper
- **Project Type:** split-front-back / worker-automation
- **Project Slug:** sherlock-scraper
- **Client Name:** Moacir
- **Status do projeto:** active / imported
- **Versão desta documentação:** 1.0
- **Última atualização:** 2026-04-10
- **Responsável pela atualização:** Orchestrator (Antigravity)

---

### 2. Resumo Arquitetural

O Sherlock Scraper é um monorepo poliglota projetado para extração, processamento e distribuição de leads B2B em alta escala.

**Resumo da arquitetura:**  
O sistema utiliza **Go** para o backend de alta performance e integração com WhatsApp, **Python** para motores de scraping flexíveis e **TypeScript/Vite** para o dashboard de gestão. A persistência é feita em **PostgreSQL** para dados relacionais de leads e **Redis** para gerenciamento de filas de tarefas e cache. Toda a infraestrutura é containerizada com **Docker**.

**Objetivo arquitetural principal:**  
Garantir desacoplamento entre os motores de busca (scrapers) e a interface de gestão, permitindo escalabilidade horizontal dos workers de extração.

---

### 3. Tipo de Projeto

- **Tipo principal:** split-front-back / worker-automation
- **Estratégia de repositório:** monorepo
- **Modo do projeto:** imported

---

### 4. Estrutura de Alto Nível

**Camadas principais do sistema:**  
1. **Scrapers (Python):** Motores de busca especializados (Google Places, CNPJ).
2. **Backend / API (Go):** Orquestração, persistência e API para o dashboard.
3. **Whatsmeow Module (Go):** Integração nativa com protocolo do WhatsApp.
4. **Frontend (TS/Vite):** Interface de visualização e controle.
5. **Infraestrutura:** Docker Compose gerenciando serviços e bancos.

**Fluxo macro da aplicação:**  
Scrapers extraem dados -> Backend salva no PostgreSQL -> Dashboard exibe leads -> Usuário/Automação dispara via Whatsmeow -> Mensagem chega ao WhatsApp do lead.

---

### 5. Estrutura de Pastas e Organização

**Paths principais:**  
- **App path:** `.` (Raiz contém os scrapers Python)
- **Frontend path:** `frontend/`
- **Backend path:** `backend/`
- **Whatsmeow path:** `whatsmeow/`
- **Docs path:** `docs/`

**Estratégia de organização do código:**  
Monorepo com separação clara por tecnologia e responsabilidade (folder-based separation).

---

### 6. Stack Técnica

**Frontend stack:** TypeScript, Vite, React, Tailwind CSS.  
**Backend stack:** Go (Echo framework), Python (Scraping libs).  
**Banco principal:** PostgreSQL.  
**Banco secundário:** Redis.  
**Queue / Jobs:** Redis (gerenciamento de jobs de scraping).  
**Infra / Deploy:** Docker, Docker Compose.

---

### 7. Módulos Principais

#### Scraper Engine (Python)
- **Responsabilidade:** Buscar e extrair dados brutos da web.
- **Observações:** Localizado na raiz do projeto.

#### Backend API (Go)
- **Responsabilidade:** Gerenciar o ciclo de vida do lead e servir dados para o dashboard.
- **Camadas envolvidas:** `backend/internal`, `backend/pkg`.

#### WhatsMiau / Whatsmeow (Go)
- **Responsabilidade:** Comunicação direta com a API do WhatsApp.
- **Observações:** Módulo de alta performance para mensageria.

#### Frontend Dashboard (TS)
- **Responsabilidade:** Interface administrativa e visualização de resultados.

---

### 8. Arquitetura por Camada

#### Frontend
**Padrão adotado:** SPA com Vite + React, focado em alta velocidade de carregamento e UX de dashboard.

#### Backend / API
**Padrão adotado:** Clean Architecture em Go, separando `internal/domain`, `internal/repository` e `internal/service`.

#### Integrações
**Padrão adotado:** Adapters para as fontes de scraping e a bridge para o Whatsmeow.

---

### 9. Padrões Arquiteturais Adotados

- **Monorepo:** Facilita o compartilhamento de configurações de infra (Docker).
- **Polyglot Services:** Uso da linguagem certa para a tarefa certa (Python para scrapers, Go para infra/mensageria).
- **API-First:** Comunicação entre frontend e backend via REST.

---

### 10. Fluxos Técnicos Relevantes

#### Fluxo de Prospecção
1. **Entrada:** Query de busca (ex: "Advogados SP").
2. **Processamento:** Scraper Python itera sobre resultados e salva no DB via API Go.
3. **Saída:** Lead visível no dashboard com dados enriquecidos.

---

### 11. Resumo Final

Arquitetura modular e poliglota focada em eficiência de extração de dados e facilidade de gestão. O uso de Docker garante que o ambiente de desenvolvimento seja idêntico ao de produção.
