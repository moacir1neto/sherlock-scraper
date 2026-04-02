package dto

// CreateScheduledMessageRequest body for POST /admin/scheduled-messages
type CreateScheduledMessageRequest struct {
	InstanceID  string `json:"instance_id" validate:"required"`
	Number      string `json:"number" validate:"required"` // 5511999999999
	MessageType string `json:"message_type" validate:"required,oneof=text image audio document"`
	Content     string `json:"content"`   // texto ou legenda
	MediaURL    string `json:"media_url"` // obrigatório para image/audio/document
	ScheduledAt string `json:"scheduled_at" validate:"required"` // ISO8601 datetime
}
