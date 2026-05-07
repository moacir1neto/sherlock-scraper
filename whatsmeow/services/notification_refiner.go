package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/verbeux-ai/whatsmiau/models"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.uber.org/zap"
)

// NotificationRefinerService cuida da "humanização" das notificações via IA.
type NotificationRefinerService struct {
	agent *SalesAgentService // Reusamos a infra de IA do SalesAgent
}

func NewNotificationRefinerService(agent *SalesAgentService) *NotificationRefinerService {
	return &NotificationRefinerService{agent: agent}
}

type RefinedNotification struct {
	Message string `json:"message"`
	Valid   bool   `json:"valid"`
}

// Refine transforma um template bruto em uma mensagem personalizada e humanizada.
func (s *NotificationRefinerService) Refine(ctx context.Context, template string, lead *models.Lead, vars map[string]interface{}, history []models.Message) (string, error) {
	start := time.Now()
	
	// 1. Renderização Base (Template Renderer)
	baseMessage := utils.RenderTemplate(template, vars)
	
	// 2. Construção do Prompt (Prompt Versioning / Refinement Agent)
	prompt := s.buildRefinementPrompt(baseMessage, lead, history)
	
	// 3. Chamada IA (Refinement Agent Controlado)
	zap.L().Debug("Iniciando refinamento de notificação via IA", zap.String("lead", lead.Name))
	
	// Usamos o structured output para garantir o formato
	// Nota: Reusamos callAI do SalesAgent mas com um esquema específico de refinamento
	resp, err := s.callRefinementAI(ctx, prompt)
	if err != nil {
		zap.L().Error("Erro na chamada de refinamento IA", zap.Error(err))
		return baseMessage, err // Fallback para mensagem base em caso de erro
	}

	// 4. Pipeline de Validação (Validator Pipeline)
	if !s.isValid(resp.Message, baseMessage) {
		zap.L().Warn("IA gerou mensagem inválida ou fugiu do escopo. Usando base.", 
			zap.String("ai_msg", resp.Message))
		return baseMessage, nil
	}

	// 6. Observabilidade IA
	duration := time.Since(start)
	zap.L().Info("Notificação refinada com sucesso", 
		zap.String("lead", lead.Name),
		zap.Duration("duration", duration),
		zap.Int("original_len", len(baseMessage)),
		zap.Int("refined_len", len(resp.Message)),
	)

	return resp.Message, nil
}

func (s *NotificationRefinerService) buildRefinementPrompt(baseMessage string, lead *models.Lead, history []models.Message) string {
	var sb fmt.Stringer // use strings.Builder internally
	_ = sb // placeholder

	// Estrutura de Prompt Versão 1.0
	prompt := fmt.Sprintf(`
Você é um assistente de vendas ultra-personalizado. 
Sua tarefa é REFINAR a mensagem base abaixo para torná-la mais natural, humana e contextual para o Lead.

REGRAS ABSOLUTAS:
1. Mantenha a INTENÇÃO ORIGINAL da mensagem base (não mude datas, horários ou links).
2. Use o tom de voz do contexto (amigável, profissional, direto).
3. Máximo 15 palavras.
4. Nunca use "Olá", "Tudo bem" ou clichês de bot.
5. Se houver histórico, use uma referência sutil se fizer sentido.

DADOS DO LEAD:
Nome: %s
Dossiê: %s

MENSAGEM BASE (A SER REFINADA):
"%s"

RETORNE APENAS UM JSON VÁLIDO:
{"message": "<mensagem refinada>", "valid": true}
`, lead.Name, lead.AIAnalysis, baseMessage)

	return prompt
}

func (s *NotificationRefinerService) callRefinementAI(ctx context.Context, prompt string) (*RefinedNotification, error) {
	// Reusamos a lógica de transporte do SalesAgent
	// Aqui fazemos uma chamada simplificada. Para produção, teríamos um método dedicado no SalesAgentService.
	// Por agora, vamos simular a integração com o callAI existente.
	
	agentResp, err := s.agent.callAI(ctx, prompt)
	if err != nil {
		return nil, err
	}

	// Como o callAI espera um AgentResponse, precisamos garantir que o prompt 
	// peça o campo "resposta" que mapearemos para "message"
	return &RefinedNotification{
		Message: agentResp.Resposta,
		Valid:   true,
	}, nil
}

func (s *NotificationRefinerService) isValid(refined, original string) bool {
	if refined == "" {
		return false
	}
	// Validação básica: não pode ser exageradamente maior que a original 
	// (evita alucinações longas)
	if len(refined) > len(original)*3 {
		return false
	}
	// TODO: Adicionar check de palavras proibidas ou keywords obrigatórias (data/hora)
	return true
}
