---
title: Stack
last_mapped: 2026-05-01
---

# STACK.md — Tecnologias e Dependências

## Visão Geral

O projeto é composto por **três serviços principais** e dois frontends, todos orquestrados via Docker Compose.

---

## Linguagens

| Camada | Linguagem | Versão |
|---|---|---|
| Backend CRM (Sherlock) | Go | 1.25 |
| Backend WhatsApp (WhatsMiau) | Go | 1.25 |
| Frontend CRM | TypeScript / React | 18.2 |
| Frontend WhatsMiau | TypeScript / React | 18.2 |
| Scripts auxiliares | Python 3 | — |

---

## Backend: Sherlock CRM (`backend/`)

**Framework HTTP:** `github.com/gofiber/fiber/v2` v2.52.12 (Fiber)

**ORM / Banco:** `gorm.io/gorm` v1.31.1 + `gorm.io/driver/postgres` v1.6.0

**Fila assíncrona:** `github.com/hibiken/asynq` v0.26.0 (backed em Redis)

**Cache / Pub-Sub:** `github.com/redis/go-redis/v9` v9.14.1

**AI:** `github.com/google/generative-ai-go` v0.18.0 (Google Gemini)

**Scraping headless:** `github.com/playwright-community/playwright-go` v0.4702.0

**Auth:** `github.com/gofiber/contrib/jwt` v1.1.2 + `github.com/golang-jwt/jwt/v5`

**Utilitários:**
- `github.com/google/uuid` v1.6.0
- `golang.org/x/crypto` v0.49.0 (bcrypt)
- `google.golang.org/api` v0.214.0 (Google Places)

---

## Backend: WhatsMiau (`whatsmeow/`)

**Framework HTTP:** `github.com/labstack/echo/v4` v4.13.4 (Echo)

**Banco:** Raw `database/sql` + `github.com/lib/pq` (PostgreSQL) + `github.com/mattn/go-sqlite3` (SQLite dev)

**WhatsApp SDK:** `go.mau.fi/whatsmeow` v0.0.0-20260421083005

**Cache / Pub-Sub:** `github.com/go-redis/redis/v8` v8.11.5

**AI:** Gemini via REST (`env.Env.GeminiAPIKey`) + Groq (`env.Env.GroqAPIKey`)

**Storage:** Google Cloud Storage (`cloud.google.com/go/storage`) — opcional (`GCS_ENABLED`)

**Logging:** `go.uber.org/zap` v1.27.0 + Google Cloud Logging (opcional)

**Auth:** `github.com/golang-jwt/jwt/v5` v5.3.1

**Env:** `github.com/caarlos0/env/v11` + `github.com/joho/godotenv`

**Validação:** `github.com/go-playground/validator/v10` v10.26.0

**WebSocket (Chat):** `github.com/coder/websocket` v1.8.14

**Sync:** `github.com/puzpuzpuz/xsync/v4` (map concorrente lock-free)

---

## Frontend CRM (`frontend/`)

**Build:** Vite 5.1 + TypeScript 5.2

**UI Framework:** React 18.2 + React Router DOM 6.22

**Drag & Drop:** `@hello-pangea/dnd` 16.5 + `@dnd-kit/core` 6.3

**Animações:** `framer-motion` 11

**HTTP:** `axios` 1.6

**Ícones:** `lucide-react` 0.323

**Notificações:** `react-hot-toast` 2.4 + `sweetalert2` 11

**Styling:** TailwindCSS 3.4 + `tailwind-merge` + `tailwindcss-animate`

---

## Frontend WhatsMiau (`whatsmeow/frontend/`)

**Build:** Vite 5.0 + TypeScript 5.2

**UI:** React 18.2 + React Router DOM 6.20

**Gráficos:** `chart.js` 4.4 + `react-chartjs-2`

**QR Code:** `qrcode.react` 3.1

**Seletor de cor:** `react-colorful` 5.6

**HTTP:** `axios` 1.6

**Notificações:** `sweetalert2` 11 + `react-hot-toast`

**Styling:** TailwindCSS 3.3

---

## Infraestrutura

**Containerização:** Docker + Docker Compose

**Banco de dados:** PostgreSQL 15 Alpine

**Cache/Fila:** Redis Alpine (porta 6379)

**Portas expostas:**

| Serviço | Porta |
|---|---|
| Python Sherlock scraper | 8000 |
| Backend CRM (Fiber) | 3005 → 3000 |
| Frontend CRM | 5173 |
| WhatsMiau API (Echo) | 8081 → 8080 |
| WhatsMiau UI | 3031 |

---

## Scripts Python

- `cnpj_scraper.py` — scraping de CNPJ via Playwright headless
- `bridge_api.py` — bridge HTTP para integração Python↔Go
