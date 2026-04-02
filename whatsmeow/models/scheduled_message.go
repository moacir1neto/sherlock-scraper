package models

import "time"

// ScheduledMessage representa uma mensagem agendada para envio (texto, imagem, áudio ou documento).
type ScheduledMessage struct {
	ID          string    `json:"id" db:"id"`
	CompanyID   string    `json:"company_id" db:"company_id"`
	InstanceID  string    `json:"instance_id" db:"instance_id"`
	RemoteJID   string    `json:"remote_jid" db:"remote_jid"` // número ou JID (5511999999999)
	MessageType string    `json:"message_type" db:"message_type"` // text, image, audio, document
	Content     string    `json:"content" db:"content"`         // texto ou legenda
	MediaURL    string    `json:"media_url,omitempty" db:"media_url"`
	ScheduledAt time.Time `json:"scheduled_at" db:"scheduled_at"`
	Status      string    `json:"status" db:"status"` // pending, sent, cancelled, failed
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	SentAt      *time.Time `json:"sent_at,omitempty" db:"sent_at"`
	ErrorMsg    string    `json:"error_msg,omitempty" db:"error_msg"`
}
