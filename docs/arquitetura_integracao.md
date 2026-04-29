# Documento de Arquitetura e Integração: Sherlock Scraper & WhatsMiau

## 1. Visão Geral do Ecossistema: O Caçador e o Atendente

O ecossistema é composto por dois pilares fundamentais que trabalham em simbiose para automatizar o funil de vendas, desde a prospecção até o primeiro contato.

*   **O Caçador (Sherlock Scraper):** Um motor de busca e extração de dados especializado em encontrar leads qualificados (B2B). Ele vasculha fontes como Google Places e portais de dados públicos (CNPJ) para identificar empresas, extraindo nomes, localizações e, crucialmente, números de WhatsApp.
*   **O Atendente (WhatsMiau):** Um sistema de CRM e Hub de Mensageria multi-tenant com backend em Go. Sua função é receber os leads "caçados", organizá-los em um pipeline (Kanban) e iniciar conversas automatizadas via WhatsApp, permitindo que agentes humanos assumam o controle quando necessário.

---

## 2. Mapeamento do WhatsMiau (Funcionalidades)

Baseado na análise do código-fonte e interface, o WhatsMiau oferece as seguintes capacidades:

1.  **Gestão de Instâncias:** Interface para conectar múltiplos números de WhatsApp simultaneamente, gerenciando o status da conexão e QR Code via protocolo `whatsmeow` (Go).
2.  **Chat Multi-agente:** Um console centralizado onde diversos operadores podem responder mensagens de diferentes instâncias, com suporte a setores e tags para organização.
3.  **Kanban de CRM:** Visualização em colunas para gerenciar o progresso do lead (ex: Prospecção -> Primeiro Contato -> Proposta -> Fechamento).
4.  **Webhooks & Fluxos de Automação:** Sistema para notificar sistemas externos e um **Flow Editor** visual para criar árvores de decisão e respostas automáticas (qualificação de leads).
5.  **Multi-tenant:** Arquitetura preparada para múltiplas empresas, cada uma com seus próprios usuários, instâncias e dados isolados.

---

## 3. Arquitetura de Diretórios e Stack Técnica

O projeto segue uma estrutura moderna e robusta:

*   **Backend (Go/Echo):** Localizado em `/whatsmeow`.
    *   `models/`: Entidades como `Company`, `Instance`, `Flow`, `Message`.
    *   `services/`: Lógica de negócio e integração com a lib `whatsmeow`.
    *   `repositories/`: Persistência via PostgreSQL (SQLStore) e Redis.
    *   `server/routes/`: Endpoints REST, incluindo compatibilidade com **Evolution API**.
*   **Frontend (React/Vite):** Localizado em `/whatsmeow/frontend`.
    *   `App.tsx`, `pages/`: Telas de Kanban, Chat e Editor de Fluxos.
*   **Infraestrutura (Docker):**
    *   Rede compartilhada entre Sherlock e WhatsMiau.
    *   PostgreSQL como banco principal.
    *   Redis para cache de estados e filas.

---

## 4. Estratégia de Integração: Sherlock → WhatsMiau

A integração será realizada via **API REST**, utilizando a camada de compatibilidade do WhatsMiau para maior flexibilidade.

### Mecanismo: Chamadas Síncronas via API REST
O Sherlock Scraper fará requisições `POST` para o serviço `whatsmiau-api`.

**Endpoint Sugerido:** `POST /v1/message/sendText/:instance`
*   **Autenticação:** JWT ou API Key definida por instância/empresa.
*   **Fluxo Técnico:**
    1.  Sherlock extrai o lead.
    2.  Sherlock resolve o hostname `whatsmiau-api` (via Docker Network).
    3.  Sherlock envia JSON com telefone e mensagem inicial.

---

## 5. Fluxo de Dados (User Journey)

Pasos detalhados desde a extração até a primeira resposta:

1.  **Extração:** Sherlock Scraper (Python/Go) identifica um lead e seu número de WhatsApp.
2.  **Higienização:** Os dados são limpos e verificados (formato internacional E.164).
3.  **Encaminhamento:** O Sherlock envia o lead para a API do WhatsMiau.
4.  **Criação de Contexto:** O WhatsMiau registra o lead, cria uma entrada no chat e um cartão no Kanban.
5.  **Automação:** O WhatsMiau dispara a primeira mensagem de prospecção configurada no **Flow Editor**.
6.  **Interação:** O lead responde, e o fluxo automatizado qualifica o interesse antes de notificar um agente humano.

---

## 6. Plano de Ação Técnico

Passos imediatos para implementação:

1.  **Configuração Docker:** Validar que ambos os serviços estão na mesma rede no `docker-compose.yml`.
2.  **Credenciais:** Configurar as variáveis de ambiente no `.env` do Sherlock para apontar para `http://whatsmiau-api:8080`.
3.  **Desenvolvimento da Bridge:** Implementar no Sherlock o `LeadDispatcher` que consome a API REST do WhatsMiau.
4.  **Configuração do Flow:** No WhatsMiau, criar um "Flow" padrão para novos leads vindos do Sherlock.
5.  **Teste de Ponta a Ponta:** Rodar um processo de scraping local e verificar se a mensagem chega ao celular de teste via instância do WhatsMiau.
6.  **Monitoramento:** Utilizar o `WebhookLogs.tsx` do WhatsMiau para monitorar falhas de entrega.
