# Technical Database — Sherlock Scraper

### 1. Identificação do Documento

- **Project Name:** Sherlock Scraper
- **Project Type:** split-front-back / worker-automation
- **Project Slug:** sherlock-scraper
- **Client Name:** Moacir
- **Versão desta documentação:** 2.0
- **Última atualização:** 2026-04-14
- **Responsável pela atualização:** Orchestrator (Antigravity)

---

### 2. Estratégia de Persistência

| Banco | Uso |
|-------|-----|
| **PostgreSQL** | Dados relacionais de longo prazo — leads, usuários, pipeline, settings |
| **Redis** | Filas Asynq, Pub/Sub SSE, cache de sessões WhatsApp |

**ORM:** GORM v2 com AutoMigrate — campos novos adicionados ao struct `domain.Lead` são criados automaticamente no boot sem migration manual.

---

### 3. Entidade Principal: Lead

**Tabela:** `leads`  
**Definida em:** `backend/internal/core/domain/lead.go`

| Campo | Tipo | Observação |
|-------|------|-----------|
| `id` | uuid | PK, `gen_random_uuid()` |
| `scraping_job_id` | uuid FK | nullable — vínculo com job de scraping |
| `empresa` | varchar(255) | Nome da empresa |
| `nicho` | varchar(255) | Segmento / nicho |
| `rating` | varchar(50) | Nota Google (ex: "4,5") |
| `qtd_avaliacoes` | varchar(50) | Total de avaliações Google |
| `resumo_negocio` | text | Resumo extraído |
| `endereco` | varchar(500) | Endereço completo |
| `telefone` | varchar(50) | Normalizado E.164 via `BeforeSave` |
| `tipo_telefone` | varchar(50) | celular / fixo / etc |
| `link_whatsapp` | varchar(255) | `https://wa.me/<telefone>` — gerado automaticamente |
| `site` | varchar(255) | URL do site |
| `email` | varchar(255) | Email |
| `instagram` | varchar(255) | URL Instagram |
| `facebook` | varchar(255) | URL Facebook |
| `linkedin` | varchar(255) | URL LinkedIn |
| `tiktok` | varchar(255) | URL TikTok |
| `youtube` | varchar(255) | URL YouTube |
| `cnpj` | varchar(20) | CNPJ |
| `tem_pixel` | bool | Facebook Pixel detectado no site |
| `tem_gtm` | bool | Google Tag Manager detectado no site |
| `deep_data` | jsonb | Dados brutos do worker `enrich:lead` (Google, Instagram, Facebook, website) |
| `ai_analysis` | jsonb | Análise de IA gerada pelo `AIService` (raiox/email/call) |
| `dossier_data` | jsonb | Dados brutos agregados do pipeline `dossier:analyze` |
| `dossier_analysis` | text | Análise LLM do pipeline `dossier:analyze` (texto JSON) |
| `status` | varchar(50) | `CAPTURADO` / `ENRIQUECENDO` / `ENRIQUECIDO` |
| `kanban_status` | varchar(50) | `prospeccao` / `contatado` / `reuniao_agendada` / `negociacao` / `ganho` / `perdido` |
| `notas_prospeccao` | text | Notas livres |
| `estimated_value` | decimal(12,2) | Valor estimado do negócio |
| `due_date` | date | nullable |
| `tags` | varchar(500) | Tags separadas por vírgula |
| `linked_lead_id` | uuid FK | nullable — vinculação entre leads |
| `created_at` / `updated_at` | timestamp | GORM automático |

**Hooks GORM no Lead:**
- `BeforeCreate` — gera UUID se vazio, define `KanbanStatus` e `Status` padrão
- `BeforeSave` — normaliza `Telefone` para E.164 via `phoneutil`; preenche `LinkWhatsapp`

---

### 4. Diferença entre `deep_data`, `ai_analysis`, `dossier_data` e `dossier_analysis`

| Campo | Preenchido por | Conteúdo |
|-------|---------------|---------|
| `deep_data` | Worker `enrich:lead` | Dados brutos de scraping: `{ google, instagram, facebook, website }` |
| `ai_analysis` | `AIService.GenerateLeadStrategy()` | JSON estruturado: score, classificação, icebreaker, pitch, etc. |
| `dossier_data` | Worker `dossier:analyze` | Dados brutos das 4 etapas do pipeline deep research |
| `dossier_analysis` | Worker `dossier:analyze` (Gemini) | JSON de análise LLM com resumo executivo, score, gap crítico, etc. |

---

### 5. Outras Entidades

#### ScrapingJob
- Agrupa leads extraídos por uma busca (nicho + localização)
- Campos: `id`, `nicho`, `localizacao`, `status` (`running`/`completed`/`error`), `logs`

#### User
- Usuário do painel Sherlock
- Campos: `id`, `name`, `email`, `password_hash`

#### CompanySetting
- Configurações da empresa (vendedor) — nicho, oferta, tom de voz
- Seed automático no boot se não existir

#### Pipeline / PipelineStage
- CRM Kanban configurável
- `Pipeline` → `PipelineStage[]` (ordenados por posição)

#### ProcessedMessage
- Controle de idempotência para mensagens WhatsApp já processadas

---

### 6. Redis — Canais Pub/Sub

| Canal | Publicado por | Consumido por |
|-------|--------------|--------------|
| `campaigns:logs:<campaign_id>` | Worker `lead:bulk-message` | `CampaignSSEHandler` → frontend |
| `dossier:logs:<lead_id>` | Worker `dossier:analyze` | `DossierHandler.Stream` → frontend |
| `whatsapp:messages:received` | WhatsMiau (ao receber msg) | `RedisSubscriber` → Kanban automation |
| `sherlock:leads:kanban_moved` | `RedisBroadcaster` | Dashboard WhatsMiau |

---

### 7. Migrations e Evolução de Schema

**Estratégia atual:** AutoMigrate via GORM — `database.Connect()` chama `db.AutoMigrate(...)` com todas as entidades no boot.

**Entidades no AutoMigrate (em `database.go`):**
`User`, `ScrapingJob`, `Lead`, `CompanySetting`, `Pipeline`, `PipelineStage`, `ProcessedMessage`

**Consequência:** adicionar campo ao struct → coluna criada no próximo boot. Remoção ou renomeação de campos **não** é automatizada — requer intervenção manual no banco.

**Recomendação para produção:** adotar `golang-migrate` para controle explícito de versão do schema.

---

### 8. Limitações Conhecidas

- **Deduplicação:** leads de fontes diferentes (Google vs CNPJ) podem gerar duplicatas — sem merge automático implementado
- **AutoMigrate em produção:** risco de lock em tabelas grandes; monitorar tempo de boot após deploy com schema changes
- **`dossier_analysis` como `text`:** armazena JSON bruto da LLM sem validação de schema — parser do frontend deve ser tolerante a campos ausentes
