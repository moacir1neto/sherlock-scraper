package main

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	"github.com/google/uuid"
	"github.com/verbeux-ai/whatsmiau/env"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

func main() {
	if err := env.Load(); err != nil {
		fmt.Fprintf(os.Stderr, "Erro ao carregar variáveis de ambiente: %v\n", err)
		os.Exit(1)
	}

	// Inicializa logger básico
	logger, _ := zap.NewDevelopment()
	zap.ReplaceGlobals(logger)

	// Solicita informações
	var nome, email, senha string

	if len(os.Args) > 1 {
		nome = os.Args[1]
	} else {
		fmt.Print("Nome do super admin [Admin]: ")
		fmt.Scanln(&nome)
		if nome == "" {
			nome = "Admin"
		}
	}

	if len(os.Args) > 2 {
		email = os.Args[2]
	} else {
		fmt.Print("Email do super admin [admin@admin.com]: ")
		fmt.Scanln(&email)
		if email == "" {
			email = "admin@admin.com"
		}
	}

	if len(os.Args) > 3 {
		senha = os.Args[3]
	} else {
		fmt.Print("Senha do super admin [admin123]: ")
		fmt.Scanln(&senha)
		if senha == "" {
			senha = "admin123"
		}
	}

	// Gera hash da senha
	hashedPassword, err := utils.HashPassword(senha)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Erro ao gerar hash da senha: %v\n", err)
		os.Exit(1)
	}

	// Conecta ao banco
	db, err := sql.Open(env.Env.DBDialect, env.Env.DBURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Erro ao conectar ao banco: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// Verifica se usuário já existe
	var existingID string
	err = db.QueryRow("SELECT id FROM users WHERE email = $1", email).Scan(&existingID)
	if err == nil {
		// Atualiza usuário existente
		_, err = db.Exec(`
			UPDATE users 
			SET nome = $1, senha = $2, role = 'super_admin', updated_at = $3
			WHERE email = $4
		`, nome, hashedPassword, time.Now(), email)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Erro ao atualizar usuário: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("✅ Usuário atualizado com sucesso!\n")
	} else {
		// Cria novo usuário
		userID := uuid.New().String()
		_, err = db.Exec(`
			INSERT INTO users (id, nome, email, senha, role, created_at, updated_at)
			VALUES ($1, $2, $3, $4, 'super_admin', $5, $5)
		`, userID, nome, email, hashedPassword, time.Now())
		if err != nil {
			fmt.Fprintf(os.Stderr, "Erro ao criar usuário: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("✅ Usuário criado com sucesso!\n")
	}

	fmt.Printf("\n📋 Credenciais:\n")
	fmt.Printf("  Email: %s\n", email)
	fmt.Printf("  Senha: %s\n", senha)
	fmt.Printf("\n⚠️  IMPORTANTE: Altere a senha após o primeiro login!\n")
}

