package services

import (
	"context"
	"time"

	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/lib/whatsmiau"
	"github.com/verbeux-ai/whatsmiau/models"
	"go.uber.org/zap"
)

// ChatBroadcaster is implemented by server/ws.Hub for real-time push. If nil, workers do not broadcast.
type ChatBroadcaster interface {
	BroadcastEvent(instanceID string, eventType string, data interface{})
}

const chatJobBufferSize = 10000
const chatWorkerCount = 4

// RunChatWorkers starts workers that consume from the chat job channel and persist to DB.
// Pass the same channel to whatsmiau.Get().SetChatJobChan(ch). If broadcaster is non-nil, workers will broadcast after persist.
func RunChatWorkers(ch <-chan whatsmiau.ChatJob, chatRepo interfaces.ChatRepository, messageRepo interfaces.MessageRepository, broadcaster ChatBroadcaster) {
	for i := 0; i < chatWorkerCount; i++ {
		go func(workerID int) {
			for job := range ch {
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				if err := processChatJob(ctx, job, chatRepo, messageRepo, broadcaster); err != nil {
					zap.L().Error("chat worker failed", zap.Int("worker", workerID), zap.String("type", job.Type), zap.String("instance", job.InstanceID), zap.Error(err))
				}
				cancel()
			}
		}(i)
	}
	zap.L().Info("chat workers started", zap.Int("count", chatWorkerCount))
}

func processChatJob(ctx context.Context, job whatsmiau.ChatJob, chatRepo interfaces.ChatRepository, messageRepo interfaces.MessageRepository, broadcaster ChatBroadcaster) error {
	switch job.Type {
	case "message":
		return processMessageJob(ctx, job, chatRepo, messageRepo, broadcaster)
	case "receipt":
		return processReceiptJob(ctx, job, chatRepo, messageRepo, broadcaster)
	default:
		return nil
	}
}

func processMessageJob(ctx context.Context, job whatsmiau.ChatJob, chatRepo interfaces.ChatRepository, messageRepo interfaces.MessageRepository, broadcaster ChatBroadcaster) error {
	if job.MessageData == nil || job.MessageData.Key == nil {
		return nil
	}
	d := job.MessageData
	remoteJid := d.Key.RemoteJid
	if remoteJid == "" {
		return nil
	}
	preview := extractContentPreview(d)
	ts := time.Unix(int64(d.MessageTimestamp), 0)
	chat := &models.Chat{
		InstanceID:         job.InstanceID,
		RemoteJID:          remoteJid,
		Name:               d.PushName,
		LastMessageAt:      &ts,
		LastMessagePreview: preview,
	}
	// Se o chat já existir e estiver finalizado, CreateOrUpdate garantirá status padrão.
	if err := chatRepo.CreateOrUpdate(ctx, chat); err != nil {
		return err
	}
	msg := &models.Message{
		ChatID:      chat.ID,
		WAMessageID: d.Key.Id,
		FromMe:      d.Key.FromMe,
		MessageType: d.MessageType,
		Content:     preview,
		Status:      d.Status,
		CreatedAt:   ts,
	}
	if d.Message != nil {
		msg.MediaURL = d.Message.MediaURL
		if msg.Content == "" && d.Message.Conversation != "" {
			msg.Content = d.Message.Conversation
		}
	}
	if err := messageRepo.Create(ctx, msg); err != nil {
		return err
	}
	if broadcaster != nil {
		broadcaster.BroadcastEvent(job.InstanceID, "new_message", map[string]interface{}{
			"chat_id": chat.ID, "message": msg, "instance_id": job.InstanceID,
		})
	}
	return nil
}

func extractContentPreview(d *whatsmiau.WookMessageData) string {
	if d.Message != nil {
		if d.Message.Conversation != "" {
			return d.Message.Conversation
		}
		if d.Message.DocumentMessage != nil && d.Message.DocumentMessage.Caption != "" {
			return d.Message.DocumentMessage.Caption
		}
		if d.Message.ImageMessage != nil && d.Message.ImageMessage.Caption != "" {
			return d.Message.ImageMessage.Caption
		}
		if d.Message.VideoMessage != nil && d.Message.VideoMessage.Caption != "" {
			return d.Message.VideoMessage.Caption
		}
	}
	return ""
}

func processReceiptJob(ctx context.Context, job whatsmiau.ChatJob, chatRepo interfaces.ChatRepository, messageRepo interfaces.MessageRepository, broadcaster ChatBroadcaster) error {
	for _, evt := range job.ReceiptEvents {
		chat, err := chatRepo.GetByInstanceAndRemoteJID(ctx, job.InstanceID, evt.RemoteJid)
		if err != nil || chat == nil {
			continue
		}
		status := "delivered"
		if evt.Status == whatsmiau.MessageStatusRead {
			status = "read"
		}
		if err := messageRepo.UpdateStatus(ctx, chat.ID, evt.MessageId, status); err != nil {
			zap.L().Debug("failed to update message status", zap.String("chat_id", chat.ID), zap.String("wa_id", evt.MessageId), zap.Error(err))
		}
		if broadcaster != nil {
			broadcaster.BroadcastEvent(job.InstanceID, "message_status", map[string]interface{}{
				"chat_id": chat.ID, "message_id": evt.MessageId, "status": status,
			})
		}
	}
	return nil
}

// NewChatJobChan returns a buffered channel for chat jobs. Use with whatsmiau.Get().SetChatJobChan(ch) and RunChatWorkers(ch, chatRepo, messageRepo).
func NewChatJobChan() chan whatsmiau.ChatJob {
	return make(chan whatsmiau.ChatJob, chatJobBufferSize)
}
