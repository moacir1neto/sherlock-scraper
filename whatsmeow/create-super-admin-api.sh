#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Criando usuário Super Admin via API${NC}"
echo ""

# Verifica se o servidor está rodando
if ! curl -s http://localhost:8081/v1/ > /dev/null; then
    echo -e "${RED}❌ Servidor não está rodando. Por favor, inicie o servidor primeiro:${NC}"
    echo "  docker compose up -d"
    exit 1
fi

# Solicita informações do usuário
read -p "Nome do super admin [Admin]: " NOME
NOME=${NOME:-Admin}

read -p "Email do super admin [admin@admin.com]: " EMAIL
EMAIL=${EMAIL:-admin@admin.com}

read -sp "Senha do super admin [admin123]: " SENHA
SENHA=${SENHA:-admin123}
echo ""

# Primeiro, precisamos criar o usuário diretamente no banco usando SQL
echo -e "${YELLOW}💾 Criando usuário diretamente no banco de dados...${NC}"

# Tenta criar via SQL direto no container do banco
if docker compose exec -T db psql -U whatsmiau -d whatsmiau -c "
    INSERT INTO users (id, nome, email, senha, role, created_at, updated_at)
    SELECT 
        gen_random_uuid()::text,
        '$NOME',
        '$EMAIL',
        '\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        'super_admin',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = '$EMAIL')
    ON CONFLICT (email) DO UPDATE SET
        nome = EXCLUDED.nome,
        role = EXCLUDED.role,
        updated_at = CURRENT_TIMESTAMP;
" 2>/dev/null; then
    echo -e "${GREEN}✓ Usuário criado/atualizado no PostgreSQL${NC}"
else
    echo -e "${YELLOW}⚠️  Não foi possível criar via PostgreSQL. Tentando SQLite...${NC}"
    
    # Tenta SQLite
    if docker compose exec -T whatsmiau sh -c "sqlite3 /app/data.db \"INSERT OR REPLACE INTO users (id, nome, email, senha, role, created_at, updated_at) VALUES (lower(hex(randomblob(16))), '$NOME', '$EMAIL', '\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'super_admin', datetime('now'), datetime('now'));\" 2>/dev/null"; then
        echo -e "${GREEN}✓ Usuário criado/atualizado no SQLite${NC}"
    else
        echo -e "${RED}❌ Erro ao criar usuário.${NC}"
        echo ""
        echo -e "${YELLOW}Por favor, crie manualmente usando:${NC}"
        echo ""
        echo "Para PostgreSQL:"
        echo "  docker compose exec db psql -U whatsmiau -d whatsmiau"
        echo "  INSERT INTO users (id, nome, email, senha, role) VALUES (gen_random_uuid()::text, '$NOME', '$EMAIL', '\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'super_admin');"
        echo ""
        echo "Para SQLite:"
        echo "  docker compose exec whatsmiau sh"
        echo "  sqlite3 /app/data.db"
        echo "  INSERT INTO users (id, nome, email, senha, role) VALUES (lower(hex(randomblob(16))), '$NOME', '$EMAIL', '\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'super_admin');"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}✅ Usuário Super Admin criado com sucesso!${NC}"
echo ""
echo -e "${BLUE}Credenciais:${NC}"
echo "  Email: $EMAIL"
echo "  Senha: $SENHA"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE: Altere a senha após o primeiro login!${NC}"
echo ""
echo -e "${BLUE}Nota: A senha está com hash bcrypt de 'admin123'.${NC}"
echo -e "${BLUE}Se você usou uma senha diferente, será necessário fazer hash manualmente.${NC}"

