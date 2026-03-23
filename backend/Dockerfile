FROM golang:alpine

WORKDIR /app

# Install necessary OS tools including Chromium and Node.js for Playwright
RUN apk add --no-cache \
    gcc \
    musl-dev \
    docker-cli \
    docker-cli-compose \
    chromium \
    chromium-chromedriver \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji \
    nodejs \
    npm \
    libc6-compat

# Set Playwright environment variables to use system Chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_NODEJS_PATH=/usr/bin/node

# We do not copy go mod here directly assuming the host volume will be mounted
# Dependencies will be installed via entrypoint

EXPOSE 3000

# The CMD assumes volume mapping will bring the code into /app
CMD ["/bin/sh", "-c", "if [ ! -f go.mod ]; then go mod init github.com/digitalcombo/sherlock-scraper/backend; fi && go mod tidy && go run cmd/api/main.go"]
