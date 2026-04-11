# Technical Integrations — Sherlock Scraper

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

O Sherlock Scraper é um sistema de "entrada" de Leads que se integra a fontes de dados externas (scraping) e a canais de saída (CRM/WhatsApp).

**Resumo das integrações:**  
O sistema consome dados brutos do Google Places e bases públicas de CNPJ via scraping, e exporta leads qualificados para o ecossistema WhatsMiau via API REST para disparo de mensagens e gestão em Kanban.

**Objetivo principal da estratégia atual:**  
Automatizar o fluxo de dados entre a descoberta do lead e a primeira interação no WhatsApp.

---

### 3. Visão Geral das Integrações

**Integrações principais do projeto:**  
- **Google Places API (Scraping):** Fonte primária de localização de empresas.
- **Portais de CNPJ (Scraping):** Fonte de enriquecimento de dados societários.
- **WhatsMiau API:** Destino dos leads para CRM e Mensageria.

---

### 4. Detalhamento por Integração

#### WhatsMiau Bridge
- **Tipo:** API REST (Síncrona)
- **Função no sistema:** Enviar lead e disparar mensagem inicial.
- **Direção do fluxo:** Sherlock -> WhatsMiau
- **Credenciais necessárias:** API Token / Instance Key.
- **Observações:** Utiliza a rede Docker interna (`whatsmiau-api:8080`) para comunicação direta.

#### Google Places (Scraping)
- **Tipo:** Web Scraping / Proxy API
- **Função no sistema:** Buscar empresas por categoria e geolocalização.
- **Observações:** Sujeito a rate limits e mudanças estruturais da fonte.

#### CNPJ Scraper
- **Tipo:** HTTP Scraping
- **Função no sistema:** Enriquecimento de dados (sócios, atividade).
- **Observações:** Crucial para qualificação técnica do lead.

---

### 5. Fluxos de Integração Mais Importantes

#### Distribuição de Lead
1. **Entrada:** Lead recém-minerado e validado.
2. **Processamento interno:** Formatado para exportação.
3. **Integração acionada:** `POST` para `whatsmiau-api/message/sendText`.
4. **Saída esperada:** Confirmação de recebimento pelo WhatsMiau e início da automação de resposta.

---

### 6. Tratamento de Erros e Resiliência

**Estratégia de tratamento de erro:**  
- Falhas no envio para o WhatsMiau devem ser logadas e o status do lead marcado como "falha no envio" para permitir re-try manual via dashboard.
- Falhas de scraping (bloqueios) ativam alertas no dashboard para troca de proxies ou rotação de tokens.

---

### 7. Riscos e Limitações Atuais

**Riscos conhecidos:**  
- Mudança nos seletores CSS/HTML das fontes de scraping (Google/CNPJ).
- Instabilidade na conexão WhatsMiau/WhatsApp (QR Code desconectado).
- Rate-limit agressivo se o volume de prospecção for muito alto.

---

### 8. Boas Práticas Obrigatórias Neste Projeto

- Centralizar todos os endpoints de integração em constantes/.env.
- Validar o status da instância WhatsMiau antes de tentar o envio.
- Registrar logs de `latency` e `error_code` de todas as chamadas externas.
