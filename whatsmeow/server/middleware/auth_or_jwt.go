package middleware

import (
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/utils"
)

// AuthOrJWT accepts either a valid JWT (Bearer or query param "token") or a valid API key. Use as the global auth so panel (JWT) and external integrations (API key) both work.
func AuthOrJWT(ctx echo.Context, next echo.HandlerFunc) error {
	if ctx.Request().Method == "GET" && strings.HasPrefix(ctx.Path(), "/v1/uploads/") {
		return next(ctx)
	}
	authHeader := ctx.Request().Header.Get("Authorization")
	tokenStr := ""
	if authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 && parts[0] == "Bearer" {
			tokenStr = parts[1]
		}
	}
	if tokenStr == "" {
		tokenStr = ctx.QueryParam("token")
	}
	if tokenStr != "" {
		claims, err := utils.ValidateToken(tokenStr)
		if err == nil {
			ctx.Set("user_id", claims.UserID)
			ctx.Set("user_email", claims.Email)
			ctx.Set("user_role", claims.Role)
			if claims.CompanyID != nil && *claims.CompanyID != "" {
				ctx.Set("company_id", *claims.CompanyID)
			} else {
				ctx.Set("company_id", "")
			}
			return next(ctx)
		}
	}
	// Fall back to API key
	return Auth(ctx, next)
}
