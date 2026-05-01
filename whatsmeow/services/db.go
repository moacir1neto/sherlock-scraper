package services

import (
	"database/sql"
	"fmt"

	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	"github.com/verbeux-ai/whatsmiau/env"
	"go.uber.org/zap"
)

var dbInstance *sql.DB

func DB() (*sql.DB, error) {
	if dbInstance == nil {
		db, err := sql.Open(env.Get().DBDialect, env.Get().DBURL)
		if err != nil {
			return nil, fmt.Errorf("failed to open database: %w", err)
		}

		if err := db.Ping(); err != nil {
			return nil, fmt.Errorf("failed to ping database: %w", err)
		}

		db.SetMaxOpenConns(25)
		db.SetMaxIdleConns(5)

		dbInstance = db
		zap.L().Info("Database connection established")
	}

	return dbInstance, nil
}
