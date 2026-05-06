package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/env"
	"go.uber.org/zap"
)

func Auth(ctx echo.Context, next echo.HandlerFunc) error {
	gotApikey := ctx.Request().Header.Get("apikey")
	if len(env.Get().ApiKey) == 0 {
		return next(ctx)
	}

	if gotApikey != env.Get().ApiKey {
		zap.L().Warn("API key mismatch",
			zap.String("method", ctx.Request().Method),
			zap.String("path", ctx.Request().URL.Path),
			zap.String("got_apikey", gotApikey),
			zap.String("expected_apikey", env.Get().ApiKey),
		)
		return echo.NewHTTPError(http.StatusUnauthorized)
	}

	return next(ctx)
}

type simplifiedMiddleware func(c echo.Context, next echo.HandlerFunc) error

func Simplify(handler simplifiedMiddleware) func(next echo.HandlerFunc) echo.HandlerFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(ctx echo.Context) error {
			return handler(ctx, next)
		}
	}
}
