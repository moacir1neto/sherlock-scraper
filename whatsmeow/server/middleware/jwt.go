package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

func JWTAuth(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		// Log da requisição chegando no middleware
		zap.L().Info("JWTAuth middleware called",
			zap.String("method", c.Request().Method),
			zap.String("path", c.Request().URL.Path),
			zap.String("remote_addr", c.Request().RemoteAddr),
		)
		
		authHeader := c.Request().Header.Get("Authorization")
		if authHeader == "" {
			zap.L().Warn("Missing authorization header",
				zap.String("method", c.Request().Method),
				zap.String("path", c.Request().URL.Path),
			)
			return echo.NewHTTPError(http.StatusUnauthorized, "missing authorization header")
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			zap.L().Warn("Invalid authorization header format",
				zap.String("method", c.Request().Method),
				zap.String("path", c.Request().URL.Path),
				zap.Int("parts_count", len(parts)),
			)
			return echo.NewHTTPError(http.StatusUnauthorized, "invalid authorization header format")
		}

		tokenString := parts[1]
		claims, err := utils.ValidateToken(tokenString)
		if err != nil {
			zap.L().Warn("Invalid token",
				zap.String("method", c.Request().Method),
				zap.String("path", c.Request().URL.Path),
				zap.Error(err),
			)
			return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
		}

		zap.L().Info("Token validated successfully",
			zap.String("method", c.Request().Method),
			zap.String("path", c.Request().URL.Path),
			zap.String("user_id", claims.UserID),
			zap.String("user_email", claims.Email),
			zap.String("user_role", claims.Role),
		)

		// Store claims in context
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_role", claims.Role)
		// Handle CompanyID as pointer - convert to string if not nil
		if claims.CompanyID != nil && *claims.CompanyID != "" {
			c.Set("company_id", *claims.CompanyID)
			zap.L().Info("CompanyID set from JWT", 
				zap.String("company_id", *claims.CompanyID), 
				zap.String("user_id", claims.UserID),
				zap.String("user_email", claims.Email),
				zap.String("user_role", claims.Role),
			)
		} else {
			c.Set("company_id", "")
			zap.L().Warn("CompanyID is nil or empty in JWT", 
				zap.String("user_id", claims.UserID), 
				zap.String("role", claims.Role),
				zap.String("email", claims.Email),
			)
		}

		return next(c)
	}
}

