FROM golang:alpine

WORKDIR /app

# Install necessary OS tools
RUN apk add --no-cache gcc musl-dev

# We do not copy go mod here directly assuming the host volume will be mounted
# Dependencies will be installed via entrypoint

EXPOSE 3000

# The CMD assumes volume mapping will bring the code into /app
CMD ["/bin/sh", "-c", "if [ ! -f go.mod ]; then go mod init github.com/digitalcombo/sherlock-scraper/backend; fi && go mod tidy && go run cmd/api/main.go"]
