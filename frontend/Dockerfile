FROM node:20-alpine

WORKDIR /app

# Instalar dependências primeiro para aproveitar o cache do Docker
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copiar o restante do código
COPY . .

# Expor porta do Vite
EXPOSE 5173

# Rodar em modo dev (o host 0.0.0.0 é vital para funcionar no Docker)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
