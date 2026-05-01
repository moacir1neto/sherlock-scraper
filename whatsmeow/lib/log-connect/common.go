package log_connect

import (
	"github.com/verbeux-ai/whatsmiau/env"
	"go.uber.org/zap"
)

func StartLogger() error {
	if env.Get().GCLEnabled {
		c, err := startGCL()
		if err != nil {
			return err
		}
		zap.ReplaceGlobals(zap.New(*c))
		return nil
	}

	logger, err := zap.NewProduction()
	if env.Get().DebugMode {
		logger, err = zap.NewDevelopment()
	}

	if err != nil {
		return err
	}

	zap.ReplaceGlobals(logger)

	return nil
}
