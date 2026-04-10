package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	"github.com/google/uuid"
	"github.com/verbeux-ai/whatsmiau/utils"
)

func main() {
	// Get database connection from environment
	dialect := os.Getenv("DIALECT_DB")
	if dialect == "" {
		dialect = "postgres"
	}

	dbURL := os.Getenv("DB_URL")
	if dbURL == "" {
		if dialect == "postgres" {
			dbURL = "postgres://whatsmiau:123456@db:5432/whatsmiau?sslmode=disable"
		} else {
			dbURL = "file:whatsmiau.db"
		}
	}

	db, err := sql.Open(dialect, dbURL)
	if err != nil {
		fmt.Printf("❌ Erro ao conectar ao banco: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		fmt.Printf("❌ Erro ao fazer ping no banco: %v\n", err)
		os.Exit(1)
	}

	// Hash da senha padrão
	hashedPassword, err := utils.HashPassword("admin123")
	if err != nil {
		fmt.Printf("❌ Erro ao gerar hash da senha: %v\n", err)
		os.Exit(1)
	}

	// Usuários de desenvolvimento
	devUsers := []struct {
		email string
		nome  string
		role  string
	}{
		{"superadmin@admin.com", "Super Admin", "super_admin"},
		{"admin@admin.com", "Admin", "admin"},
		{"user@admin.com", "Usuário", "user"},
	}

	fmt.Println("🔐 Criando usuários de desenvolvimento...")
	fmt.Println("")

	for _, devUser := range devUsers {
		// Verificar se usuário já existe
		var existingID string
		err := db.QueryRow("SELECT id FROM users WHERE email = $1", devUser.email).Scan(&existingID)

		if err == sql.ErrNoRows {
			// Criar novo usuário
			id := uuid.New().String()
			_, err := db.Exec(
				"INSERT INTO users (id, nome, email, senha, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())",
				id, devUser.nome, devUser.email, hashedPassword, devUser.role,
			)
			if err != nil {
				fmt.Printf("❌ Erro ao criar usuário %s: %v\n", devUser.email, err)
				continue
			}
			fmt.Printf("✅ Criado: %s (%s)\n", devUser.email, devUser.role)
		} else if err != nil {
			fmt.Printf("⚠️  Erro ao verificar usuário %s: %v\n", devUser.email, err)
			continue
		} else {
			// Atualizar usuário existente
			_, err := db.Exec(
				"UPDATE users SET nome = $1, senha = $2, role = $3, updated_at = NOW() WHERE email = $4",
				devUser.nome, hashedPassword, devUser.role, devUser.email,
			)
			if err != nil {
				fmt.Printf("❌ Erro ao atualizar usuário %s: %v\n", devUser.email, err)
				continue
			}
			fmt.Printf("🔄 Atualizado: %s (%s)\n", devUser.email, devUser.role)
			
			// Limpar cache do Redis se estiver disponível
			// Nota: Isso requer conexão com Redis, mas não é crítico se falhar
			fmt.Printf("💡 Dica: Limpe o cache do Redis se o problema persistir:\n")
			fmt.Printf("   docker compose exec redis redis-cli FLUSHALL\n")
		}
	}

	fmt.Println("")
	fmt.Println("✅ Todos os usuários de desenvolvimento estão prontos!")
	fmt.Println("")
	fmt.Println("📋 Credenciais:")
	fmt.Println("   Super Admin: superadmin@admin.com / admin123")
	fmt.Println("   Admin:       admin@admin.com / admin123")
	fmt.Println("   Usuário:     user@admin.com / admin123")
}

