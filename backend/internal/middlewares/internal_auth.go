package middlewares

import (
	"os"

	"github.com/gofiber/fiber/v2"
)

// InternalAuth validates the static token used for server-to-server requests.
// Reads the expected token from the INTERNAL_API_TOKEN environment variable.
func InternalAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		expected := os.Getenv("INTERNAL_API_TOKEN")
		if expected == "" {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "internal auth not configured",
			})
		}

		token := c.Get("X-Internal-Token")
		if token != expected {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized",
			})
		}

		return c.Next()
	}
}
