package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
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

	email := "superadmin@admin.com"
	password := "admin123"

	fmt.Println("🔍 Testando verificação de senha...")
	fmt.Println("")

	// Buscar usuário
	var storedHash string
	err = db.QueryRow("SELECT senha FROM users WHERE email = $1", email).Scan(&storedHash)
	if err != nil {
		fmt.Printf("❌ Erro ao buscar usuário: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("✅ Usuário encontrado: %s\n", email)
	fmt.Printf("📏 Tamanho do hash: %d caracteres\n", len(storedHash))
	fmt.Printf("🔑 Hash (primeiros 30 chars): %s...\n", storedHash[:30])
	fmt.Println("")

	// Testar verificação
	match := utils.CheckPasswordHash(password, storedHash)
	fmt.Printf("🔐 Verificação de senha: %v\n", match)
	fmt.Println("")

	// Testar com hash novo
	fmt.Println("🔄 Gerando novo hash para comparação...")
	newHash, err := utils.HashPassword(password)
	if err != nil {
		fmt.Printf("❌ Erro ao gerar hash: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("📏 Tamanho do novo hash: %d caracteres\n", len(newHash))
	fmt.Printf("🔑 Novo hash (primeiros 30 chars): %s...\n", newHash[:30])
	fmt.Println("")

	// Verificar se o novo hash funciona
	newMatch := utils.CheckPasswordHash(password, newHash)
	fmt.Printf("🔐 Verificação com novo hash: %v\n", newMatch)
	fmt.Println("")

	// Comparar hashes
	if storedHash == newHash {
		fmt.Println("⚠️  ATENÇÃO: Os hashes são idênticos (improvável com bcrypt)")
	} else {
		fmt.Println("✅ Hashes são diferentes (normal com bcrypt)")
	}

	if match {
		fmt.Println("")
		fmt.Println("✅✅✅ SENHA ESTÁ CORRETA NO BANCO! ✅✅✅")
	} else {
		fmt.Println("")
		fmt.Println("❌❌❌ PROBLEMA: Senha não corresponde ao hash! ❌❌❌")
		fmt.Println("")
		fmt.Println("💡 SOLUÇÃO: Vamos atualizar o hash no banco...")
		
		// Atualizar hash
		_, err = db.Exec("UPDATE users SET senha = $1 WHERE email = $2", newHash, email)
		if err != nil {
			fmt.Printf("❌ Erro ao atualizar hash: %v\n", err)
			os.Exit(1)
		}
		
		fmt.Println("✅ Hash atualizado no banco!")
		
		// Verificar novamente
		match = utils.CheckPasswordHash(password, newHash)
		if match {
			fmt.Println("✅✅✅ AGORA A SENHA DEVE FUNCIONAR! ✅✅✅")
		}
	}
}

