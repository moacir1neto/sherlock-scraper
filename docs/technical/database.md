# Technical Database — Sherlock Scraper

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

O projeto utiliza uma estratégia de persistência híbrida para lidar com dados relacionais de leads e alta performance de mensageria/filas.

**Resumo da camada de dados:**  
PostgreSQL como banco relacional principal para armazenamento de leads, configurações e histórico. Redis utilizado como banco secundário para cache de estado de conexões WhatsApp, gerenciamento de filas de scraping e controle de rate-limit.

**Objetivo principal da estratégia atual:**  
Garantir a integridade dos dados dos leads consolidados enquanto mantém a agilidade necessária para operações assíncronas de scraping e mensageria.

---

### 3. Estratégia de Banco

- **Banco principal:** PostgreSQL
- **Banco secundário:** Redis
- **ORM / ODM:** GORM (Go) / SQL Raw (Python)
- **Database access strategy:** Repositories em Go; chamadas diretas via drivers em Python.

---

### 4. Papel de Cada Banco

#### PostgreSQL
- **Função no sistema:** Persistência de longo prazo.
- **Dados principais armazenados:** Leads (nome, telefone, CNPJ, endereço), Histórico de prospecção, Usuários/Instâncias.

#### Redis
- **Função no sistema:** Cache e Mensageria.
- **Dados principais armazenados:** Estado da conexão WhatsApp (sessões whatsmeow), Filas de jobs de scraping, Chaves de cache temporário.

---

### 5. Entidade Principal: Lead

- **Nome:** Lead
- **Responsabilidade:** Centralizar todas as informações extraídas de um potencial cliente.
- **Banco:** PostgreSQL
- **Relacionamentos importantes:** Pode estar vinculado a uma `SearchQuery` ou `Instance` que o prospectou.
- **Campos críticos:** `phone` (formato E.164), `cnpj`, `source` (Google/CNPJ/Manual).

---

### 6. Organização do Acesso a Dados

**Padrão de acesso adotado:**  
- No backend Go: Padrão Repository (`backend/internal/repository`) abstraindo as chamadas ao banco via GORM.
- No Whatsmeow (Go): SQLStore nativo da biblioteca whatsmeow para persistência de sessões.
- Nos Scrapers (Python): Uso de `psycopg2` ou similar para inserção direta de leads extraídos.

---

### 7. Migrations e Evolução de Schema

**Estratégia de evolução do schema:**  
Uso de Auto-migration do GORM no backend Go para desenvolvimento. Para produção, recomenda-se a adoção de uma ferramenta de migration controlada (ex: `golang-migrate` ou `prisma`).

---

### 8. Auditoria e Rastreabilidade

O PostgreSQL armazena campos de timestamp (`created_at`, `updated_at`) e `source` para identificar quando e de onde um lead foi minerado.

---

### 9. Limitações Conhecidas

- **Deduplicação complexa:** Leads minerados de diferentes fontes (Google vs CNPJ) podem exigir lógica sofisticada de merge para evitar duplicatas sem perder dados.
- **Concorrência:** Múltiplos scrapers inserindo no mesmo banco simultaneamente exigem atenção a locks e pools de conexão.
