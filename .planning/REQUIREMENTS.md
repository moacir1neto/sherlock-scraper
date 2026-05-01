# Requirements: Sherlock & WhatsMiau Evolution

## v1 Requirements (Foco: Evolução)

### AI Agent (Super Vendedor)
- [ ] **AI-01**: Refinar structured output do Gemini para garantir 100% de conformidade com o schema JSON.
- [ ] **AI-02**: Implementar sistema de "Memória de Curto Prazo" para o agente não repetir perguntas já respondidas no mesmo chat.
- [ ] **AI-03**: Adicionar suporte a gatilhos de "Interrupção de IA" quando o lead demonstra frustração ou pede falar com humano explicitamente.
- [ ] **AI-04**: Melhorar o prompt de sistema para incluir dados específicos do dossiê do lead de forma contextual.

### Scraper (Sherlock)
- [ ] **SCR-01**: Implementar rotação de User-Agents e Headers dinâmicos para evitar bloqueios.
- [ ] **SCR-02**: Adicionar suporte a busca por múltiplas localizações em uma única tarefa de scraping.
- [ ] **SCR-03**: Melhorar o parser de dados de redes sociais (Instagram/LinkedIn) coletados durante o scraping.
- [ ] **SCR-04**: Implementar webhook de conclusão de tarefa para notificar o CRM imediatamente.

### Dossiês e Enriquecimento
- [ ] **DOS-01**: Automatizar a geração do dossiê assim que o lead é importado no CRM.
- [ ] **DOS-02**: Integrar pesquisa web (Google Search) no fluxo de geração de dossiês via Gemini.
- [ ] **DOS-03**: Salvar o dossiê em formato Markdown estruturado no banco de dados para fácil leitura pelo agente de IA.

### Core & Qualidade (Suporte às features)
- [ ] **CORE-01**: Refatorar a gestão de tokens e secrets para carregar estritamente de variáveis de ambiente (remover fallbacks hardcoded).
- [ ] **CORE-02**: Implementar testes unitários básicos para a lógica de transição de status do Kanban (kanban_automation).
- [ ] **CORE-03**: Otimizar o pooling de conexões Redis para suportar maior volume de tarefas assíncronas.

## v2 Requirements (Deferred)
- [ ] Suporte a múltiplos modelos de LLM (Claude/GPT-4) chaveáveis por empresa.
- [ ] Scraping de dados financeiros (faturamento presumido) via APIs de terceiros.
- [ ] Dashboard analítico de performance da IA (taxa de conversão/agendamento).

## Out of Scope
- Integração nativa com Zapier/Make nesta fase.
- Interface de construção de fluxos (Drag & Drop Flow Builder).

## Traceability
*(Fills during roadmap creation)*
