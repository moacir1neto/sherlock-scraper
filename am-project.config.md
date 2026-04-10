# Project Config — Sherlock Scraper

> Configuração operacional do projeto para o Orchestrator.
> Fonte de verdade para contexto, entrega e integração com GitHub Projects.

---

## 1. Identificação do Projeto

project_name=Sherlock Scraper
client_name=Moacir
project_slug=sherlock-scraper
project_description=Sistema Full-Stack de prospecção e gestão de leads com scraping, processamento de dados e painel de gestão.
project_status=active

project_type=split-front-back

project_mode=existing

default_language=pt-BR

---

## 2. Estrutura Local

base_path=/home/moadev/projetos/sherlock-scraper
repo_path=/home/moadev/projetos/sherlock-scraper

docs_path=docs
sessions_path=.cursor/memory/sessions
decisions_path=.cursor/memory/decisions
handoffs_path=.cursor/memory/handoffs

# Monorepo — front e back na mesma raiz
app_path=.
frontend_path=frontend
backend_path=backend
infra_path=infra
scripts_path=scripts

---

## 3. Repositórios e Organização

repository_strategy=monorepo

github_owner=moacir1neto
github_repository=sherlock-scraper

git_delivery_model=single_repo_branch_per_task

default_branch=main
develop_branch=develop

---

## 4. Stack da Aplicação

frontend_stack=TypeScript
backend_stack=Python,Golang,TypeScript
database_stack=PostgreSQL,Redis
orm_stack=
styling_stack=
ui_stack=
auth_stack=
storage_stack=
queue_stack=Redis
observability_stack=
ai_stack=

# Notas de stack:
# - Python: scraping e processamento de dados
# - Golang: workers / serviços de alta performance
# - TypeScript: frontend e/ou orquestração
# - PostgreSQL: persistência principal de leads
# - Redis: filas, cache e controle de jobs

---

## 5. Estrutura Arquitetural

has_admin_panel=false
has_public_landing=false
has_internal_dashboard=true
has_api_routes=true
has_background_jobs=true
has_file_upload=false
has_multitenancy=false
has_whatsapp_channel=false
has_email_channel=false
has_human_handoff=false
has_audit_logs=true

architecture_notes=Monorepo com scraper em Python, workers em Golang, frontend em TypeScript. Redis gerencia filas de jobs de scraping. PostgreSQL armazena leads e histórico.

---

## 6. Autenticação e Autorização

authentication_strategy=
authorization_strategy=
roles_model=
role_in_token=false
refresh_token_enabled=false
session_persistence_strategy=

auth_notes=Ainda não definido. Definir antes de implementar qualquer painel autenticado.

---

## 7. Banco de Dados e Persistência

primary_database=PostgreSQL
secondary_database=Redis

database_access_strategy=

stores_messages=false
stores_workflows=false
stores_agent_memory=false
stores_audit_trail=true

database_notes=PostgreSQL para leads, histórico e resultados de scraping. Redis para filas de jobs e cache de sessão.

---

## 8. Integrações Externas

uses_jira=false
uses_dokploy=false
uses_docker=true
uses_github_actions=false
uses_cloudinary=false
uses_openai=false
uses_gemini=false
uses_evolution=false
uses_email=false
uses_whatsapp=false

integration_notes=Docker provável para rodar PostgreSQL e Redis localmente e em produção.

---

## 9. Configuração de IA e Workflow

ai_enabled=false
workflow_engine_enabled=false
workflow_engine_type=

workflow_notes=

---

## 10. Canais de Comunicação

primary_channel=dashboard
secondary_channels=api

channel_notes=Interface principal via dashboard interno. API para integração futura.

---

## 11. Infraestrutura e Deploy

hosting_strategy=
container_strategy=docker-compose
registry_provider=
deploy_provider=
deploy_mode=manual

vps_provider=
server_notes=Deploy ainda não definido. Docker Compose como estratégia local e candidato a produção.

---

## 12. CI/CD

ci_provider=none

run_lint_before_build=true
run_tests_before_build=true
run_build_before_deploy=true
build_on_branch=main
deploy_on_branch=main
auto_deploy_on_merge=false

cicd_notes=CI/CD não configurado ainda. GitHub Actions é candidato natural quando deploy for definido.

---

## 13. Comandos do Projeto

# Preencher conforme o projeto for evoluindo
install_command=
dev_command=
lint_command=
test_unit_command=
build_command=
start_command=

backend_install_command=
backend_dev_command=
backend_lint_command=
backend_test_command=
backend_build_command=

commands_notes=Preencher após mapear os comandos reais de cada serviço (scraper Python, worker Go, frontend TS).

---

## 14. Gestão de Tarefas

task_management_system=github-projects

# Sem Jira — usando GitHub Projects como board principal
uses_jira=false
jira_backlog_strategy=incremental_only
jira_initial_bulk_completed=false
jira_base_url=
jira_project_key=
jira_project_name=
jira_board_name=

# GitHub Projects — board principal
github_projects_enabled=true
github_project_title=Sherlock Scraper
github_project_number=2
github_project_owner=moacir1neto

git_base_branch=main
git_feature_branch_pattern=task-{issue_key}-{slug}
pull_request_target_branch=main

branch_prefix=task
branch_pattern=task-{issue}-{slug}
commit_pattern={type}({scope}): {message}

pull_request_title_pattern=[#{issue_key}] {summary}
pull_request_body_sections=context,problem,solution,changes,testing,references
pull_request_description_minimal=false

task_notes=Fluxo: criar Issue no GitHub → adicionar ao Project com `gh project item-add` → branch → PR → merge → mover card para Done.

---

## 15. Padrões

documentation_style=clean-and-direct
coding_style=clean-and-pragmatic
architecture_style=modular
security_baseline=default
testing_strategy=minimal

prefer_server_actions=false
prefer_api_routes=true
prefer_component_reuse=true
prefer_feature_modules=true

standards_notes=

---

## 16. Onboarding Arquitetural

onboarding_questions_completed=false

decision_auth_pattern=
decision_rbac_pattern=
decision_database_pattern=PostgreSQL (leads) + Redis (filas)
decision_deploy_pattern=
decision_observability_pattern=
decision_ai_pattern=
decision_workflow_pattern=
decision_channel_pattern=

onboarding_notes=Projeto existente importado. Prioridade: mapear estrutura atual de pastas e definir auth e deploy.

---

## 17. Memória Operacional do Orchestrator

save_context_history=true
save_architecture_decisions=true
save_task_handoffs=true
save_deploy_history=true
save_prompt_versions=false

orchestrator_operating_mode=full-cycle

warmup_user_output=checklist-and-brief
taskstart_user_output=compact

orchestrator_notes=

---

## 18. Documentos Esperados

required_docs=business/overview.md,business/features.md,technical/architecture.md,technical/database.md

optional_docs=technical/infra-and-deploy.md,technical/auth-and-security.md,technical/integrations.md,decisions/

---

## 19. Status de Maturidade do Projeto

maturity_level=mvp

has_documented_architecture=false
has_documented_auth=false
has_documented_deploy=false
has_documented_integrations=false
has_documented_workflows=false

maturity_notes=Projeto em fase inicial de organização. Documentação técnica a ser criada via docs-init.

---

## 20. Observações Livres

general_notes=Projeto pessoal de prospecção de leads. Stack poliglota (Python + Go + TS). Começar com project-import + warm-up + docs-init para consolidar o contexto antes de task-start.
