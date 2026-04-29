FROM golang:alpine AS builder

WORKDIR /app

# Instala ferramentas de compilação
RUN apk add --no-cache build-base sqlite-dev gcc musl-dev

# Copia dependências e cacheia
COPY go.mod go.sum ./
RUN go mod download

# Copia o código e compila
COPY . .
RUN go mod tidy
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o whatsmiau .

FROM alpine:latest

# Instala apenas dependências de runtime
RUN apk add --no-cache ffmpeg mailcap ca-certificates

WORKDIR /app

# Copia o binário e prepara diretórios
COPY --from=builder /app/whatsmiau /app/whatsmiau
RUN mkdir /app/data && chmod 777 -R /app/data

EXPOSE 3000

ENTRYPOINT ["./whatsmiau"]