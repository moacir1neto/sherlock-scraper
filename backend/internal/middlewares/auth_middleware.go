package middlewares

import (
	"github.com/digitalcombo/sherlock-scraper/backend/internal/config"

	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
)

// Protected verifies the JWT associated with the request
func Protected() fiber.Handler {
	secret := config.Get().JWTSecret

	return jwtware.New(jwtware.Config{
		SigningKey: jwtware.SigningKey{Key: []byte(secret)},
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Unauthorized or expired token",
			})
		},
	})
}
