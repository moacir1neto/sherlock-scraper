package services

import (
	"context"
	"strings"
	"time"

	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/lib/whatsmiau"
	"github.com/verbeux-ai/whatsmiau/models"
	"go.mau.fi/whatsmeow/types"
	"go.uber.org/zap"
)

// RunScheduledWorker starts a goroutine that periodically sends pending scheduled messages.
func RunScheduledWorker(repo interfaces.ScheduledMessageRepository) {
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			runScheduledBatch(repo)
		}
	}()
	zap.L().Info("scheduled message worker started")
}

func runScheduledBatch(repo interfaces.ScheduledMessageRepository) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	list, err := repo.ListPendingUntil(ctx, time.Now())
	if err != nil {
		zap.L().Error("scheduled worker list pending", zap.Error(err))
		return
	}
	if len(list) == 0 {
		return
	}

	w := whatsmiau.Get()
	for _, m := range list {
		sendOne(ctx, w, repo, &m)
	}
}

func remoteToJID(remote string) (*types.JID, error) {
	remote = strings.TrimSpace(remote)
	if remote == "" {
		return nil, nil
	}
	jidStr := remote
	if !strings.Contains(remote, "@") {
		jidStr = remote + "@s.whatsapp.net"
	}
	j, err := types.ParseJID(jidStr)
	if err != nil {
		return nil, err
	}
	return &j, nil
}

func sendOne(ctx context.Context, w *whatsmiau.Whatsmiau, repo interfaces.ScheduledMessageRepository, m *models.ScheduledMessage) {
	jid, err := remoteToJID(m.RemoteJID)
	if err != nil || jid == nil {
		_ = repo.UpdateStatus(ctx, m.ID, m.CompanyID, "failed", nil, "invalid remote_jid")
		return
	}

	now := time.Now()
	switch m.MessageType {
	case "text":
		_, err = w.SendText(ctx, &whatsmiau.SendText{
			Text:       m.Content,
			InstanceID: m.InstanceID,
			RemoteJID:  jid,
		})
	case "image":
		_, err = w.SendImage(ctx, &whatsmiau.SendImageRequest{
			InstanceID: m.InstanceID,
			MediaURL:   m.MediaURL,
			Caption:    m.Content,
			RemoteJID:  jid,
		})
	case "audio":
		_, err = w.SendAudio(ctx, &whatsmiau.SendAudioRequest{
			InstanceID: m.InstanceID,
			AudioURL:   m.MediaURL,
			RemoteJID:  jid,
		})
	case "document":
		_, err = w.SendDocument(ctx, &whatsmiau.SendDocumentRequest{
			InstanceID: m.InstanceID,
			MediaURL:   m.MediaURL,
			Caption:    m.Content,
			RemoteJID:  jid,
		})
	default:
		_ = repo.UpdateStatus(ctx, m.ID, m.CompanyID, "failed", nil, "unknown message_type")
		return
	}

	if err != nil {
		zap.L().Warn("scheduled send failed", zap.String("id", m.ID), zap.String("instance", m.InstanceID), zap.Error(err))
		_ = repo.UpdateStatus(ctx, m.ID, m.CompanyID, "failed", nil, err.Error())
		return
	}
	_ = repo.UpdateStatus(ctx, m.ID, m.CompanyID, "sent", &now, "")
}
