.PHONY: help build up down logs restart clean

help: ## Mostra esta mensagem de ajuda
	@echo "Comandos disponíveis:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Constrói as imagens Docker
	docker compose build

up: ## Inicia os containers em modo detached
	docker compose up -d --build

down: ## Para e remove os containers
	docker compose down

logs: ## Mostra os logs dos containers
	docker compose logs -f

restart: ## Reinicia os containers
	docker compose restart

clean: ## Para os containers e remove volumes (CUIDADO: apaga dados)
	docker compose down -v

ps: ## Lista os containers em execução
	docker compose ps

stop: ## Para os containers sem removê-los
	docker compose stop

start: ## Inicia os containers parados
	docker compose start

clear-cache: ## Limpa o cache do Redis
	@echo "🧹 Limpando cache do Redis..."
	docker compose exec redis redis-cli FLUSHALL
	@echo "✅ Cache limpo com sucesso!"

dev-mode: ## Ativa modo desenvolvimento (desativa cache)
	@echo "🔧 Ativando modo desenvolvimento..."
	@echo "DEBUG_MODE=true" >> .env
	@echo "✅ Modo desenvolvimento ativado! Reinicie os containers."
	@echo "💡 Para desativar, remova DEBUG_MODE=true do .env"

