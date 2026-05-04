package logger

import (
	"os"
	"sync"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var (
	instance *zap.Logger
	once     sync.Once
)

// Init configura o logger global do Zap.
// Deve ser chamado uma vez no startup (main.go) antes de qualquer log.
func Init() {
	once.Do(func() {
		var cfg zap.Config

		if os.Getenv("APP_ENV") == "production" {
			cfg = zap.NewProductionConfig()
		} else {
			cfg = zap.NewDevelopmentConfig()
			cfg.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
		}

		cfg.EncoderConfig.TimeKey = "timestamp"
		cfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

		built, err := cfg.Build(zap.AddCallerSkip(1))
		if err != nil {
			panic("falha ao inicializar logger: " + err.Error())
		}

		instance = built
	})
}

// Get retorna a instância global do logger.
// Chame Init() antes; caso contrário retorna um logger no-op.
func Get() *zap.Logger {
	if instance == nil {
		return zap.NewNop()
	}
	return instance
}

// Sync faz flush dos buffers pendentes. Chamar em defer no main.
func Sync() {
	if instance != nil {
		_ = instance.Sync()
	}
}
