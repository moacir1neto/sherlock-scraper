package utils

import (
	"fmt"
	"strings"
)

// RenderTemplate substitui variáveis no formato {{var}} pelos valores do mapa.
func RenderTemplate(template string, vars map[string]interface{}) string {
	result := template
	for k, v := range vars {
		placeholder := fmt.Sprintf("{{%s}}", k)
		value := fmt.Sprintf("%v", v)
		result = strings.ReplaceAll(result, placeholder, value)
	}
	return result
}
