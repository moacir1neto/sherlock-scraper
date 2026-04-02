package models

import "time"

type Message struct {
	ID           string    `json:"id" db:"id"`
	ChatID       string    `json:"chat_id" db:"chat_id"`
	WAMessageID  string    `json:"wa_message_id" db:"wa_message_id"`
	FromMe       bool      `json:"from_me" db:"from_me"`
	MessageType  string    `json:"message_type" db:"message_type"`
	Content      string    `json:"content" db:"content"`
	MediaURL     string    `json:"media_url,omitempty" db:"media_url"`
	Status       string    `json:"status" db:"status"` // sent, delivered, read
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}
