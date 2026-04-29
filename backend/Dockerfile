FROM golang:alpine AS builder

WORKDIR /app

# Instala dependências de compilação
RUN apk add --no-cache gcc musl-dev

# Copia apenas os arquivos de dependência primeiro (para cachear)
COPY go.mod go.sum ./
RUN go mod download

# Copia o resto do código e compila
COPY . .
RUN go build -o main cmd/api/main.go

# Estágio final — Container leve
FROM alpine:latest

WORKDIR /app

# Instala apenas o necessário para rodar (Docker CLI e Chromium)
RUN apk add --no-cache \
    docker-cli \
    docker-cli-compose \
    chromium \
    ca-certificates \
    libc6-compat

# Configurações do Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copia o binário compilado do estágio anterior
COPY --from=builder /app/main .

EXPOSE 3000

CMD ["./main"]
