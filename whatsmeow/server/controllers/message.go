package controllers

import (
	"net/http"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/lib/whatsmiau"
	"github.com/verbeux-ai/whatsmiau/server/dto"
	"github.com/verbeux-ai/whatsmiau/services"
	"github.com/verbeux-ai/whatsmiau/utils"
	"go.mau.fi/whatsmeow/types"
	"go.uber.org/zap"
)

type Message struct {
	repo      interfaces.InstanceRepository
	whatsmiau *whatsmiau.Whatsmiau
}

func NewMessages(repository interfaces.InstanceRepository, whatsmiau *whatsmiau.Whatsmiau) *Message {
	return &Message{
		repo:      repository,
		whatsmiau: whatsmiau,
	}
}

func (s *Message) SendText(ctx echo.Context) error {
	var request dto.SendTextRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}
	if request.InstanceID == "" {
		request.InstanceID = ctx.Param("instance")
		if request.InstanceID == "" {
			request.InstanceID = ctx.Param("id")
		}
	}

	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}

	jid, err := numberToJid(request.Number)
	if err != nil {
		zap.L().Error("error converting number to jid", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid number format")
	}

	sendText := &whatsmiau.SendText{
		Text:       request.Text,
		InstanceID: request.InstanceID,
		RemoteJID:  jid,
	}

	if request.Quoted != nil && len(request.Quoted.Key.Id) > 0 {
		sendText.QuoteMessageID = request.Quoted.Key.Id
		sendText.QuoteMessage = request.Quoted.Message.Conversation
		sendText.QuoteFromMe = request.Quoted.Key.FromMe
		// Em chat 1:1, o autor da mensagem citada é o próprio remote; em grupo seria outro JID.
		if !request.Quoted.Key.FromMe {
			sendText.Participant = jid
		}
	}

	c := ctx.Request().Context()
	if err := s.whatsmiau.ChatPresence(&whatsmiau.ChatPresenceRequest{
		InstanceID: request.InstanceID,
		RemoteJID:  jid,
		Presence:   types.ChatPresenceComposing,
	}); err != nil {
		zap.L().Error("Whatsmiau.ChatPresence", zap.Error(err))
	} else {
		time.Sleep(time.Millisecond * time.Duration(request.Delay)) // TODO: create a more robust solution
	}

	res, err := s.whatsmiau.SendText(c, sendText)
	if err != nil {
		zap.L().Error("Whatsmiau.SendText failed", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to send text")
	}

	s.whatsmiau.EnqueueSentMessage(request.InstanceID, jid.ToNonAD().String(), res.ID, request.Text)

	return ctx.JSON(http.StatusOK, dto.SendTextResponse{
		Key: dto.MessageResponseKey{
			RemoteJid: request.Number,
			FromMe:    true,
			Id:        res.ID,
		},
		Status: "sent",
		Message: dto.SendTextResponseMessage{
			Conversation: request.Text,
		},
		MessageType:      "conversation",
		MessageTimestamp: int(res.CreatedAt.Unix() / 1000),
		InstanceId:       request.InstanceID,
	})
}

func (s *Message) SendAudio(ctx echo.Context) error {
	var request dto.SendAudioRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}

	jid, err := numberToJid(request.Number)
	if err != nil {
		zap.L().Error("error converting number to jid", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid number format")
	}

	sendText := &whatsmiau.SendAudioRequest{
		AudioURL:   request.Audio,
		InstanceID: request.InstanceID,
		RemoteJID:  jid,
	}

	if request.Quoted != nil && len(request.Quoted.Key.Id) > 0 && len(request.Quoted.Message.Conversation) > 0 {
		sendText.QuoteMessage = request.Quoted.Message.Conversation
		sendText.QuoteMessageID = request.Quoted.Key.Id
	}

	c := ctx.Request().Context()
	if err := s.whatsmiau.ChatPresence(&whatsmiau.ChatPresenceRequest{
		InstanceID: request.InstanceID,
		RemoteJID:  jid,
		Presence:   types.ChatPresenceComposing,
		Media:      types.ChatPresenceMediaAudio,
	}); err != nil {
		zap.L().Error("Whatsmiau.ChatPresence", zap.Error(err))
	} else {
		time.Sleep(time.Millisecond * time.Duration(request.Delay)) // TODO: create a more robust solution
	}

	res, err := s.whatsmiau.SendAudio(c, sendText)
	if err != nil {
		zap.L().Error("Whatsmiau.SendAudioRequest failed", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to send audio")
	}
	s.whatsmiau.EnqueueSentMessage(request.InstanceID, jid.ToNonAD().String(), res.ID, "[Áudio]")

	return ctx.JSON(http.StatusOK, dto.SendAudioResponse{
		Key: dto.MessageResponseKey{
			RemoteJid: request.Number,
			FromMe:    true,
			Id:        res.ID,
		},

		Status:           "sent",
		MessageType:      "audioMessage",
		MessageTimestamp: int(res.CreatedAt.Unix() / 1000),
		InstanceId:       request.InstanceID,
	})
}

// For evolution compatibility
func (s *Message) SendMedia(ctx echo.Context) error {
	var request dto.SendMediaRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}
	switch request.Mediatype {
	case "image":
		request.SendDocumentRequest.Mimetype = "image/png"
		return s.sendImage(ctx, request.SendDocumentRequest)
	}

	return s.sendDocument(ctx, request.SendDocumentRequest)
}

func (s *Message) SendDocument(ctx echo.Context) error {
	var request dto.SendDocumentRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}

	return s.sendDocument(ctx, request)
}

func (s *Message) sendDocument(ctx echo.Context, request dto.SendDocumentRequest) error {
	jid, err := numberToJid(request.Number)
	if err != nil {
		zap.L().Error("error converting number to jid", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid number format")
	}

	sendData := &whatsmiau.SendDocumentRequest{
		InstanceID: request.InstanceID,
		MediaURL:   request.Media,
		Caption:    request.Caption,
		FileName:   request.FileName,
		RemoteJID:  jid,
		Mimetype:   request.Mimetype,
	}

	c := ctx.Request().Context()
	time.Sleep(time.Millisecond * time.Duration(request.Delay)) // TODO: create a more robust solution

	res, err := s.whatsmiau.SendDocument(c, sendData)
	if err != nil {
		zap.L().Error("Whatsmiau.SendDocument failed", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to send document")
	}
	capOrPlaceholder := request.Caption
	if capOrPlaceholder == "" {
		capOrPlaceholder = "[Documento]"
	}
	s.whatsmiau.EnqueueSentMessage(request.InstanceID, jid.ToNonAD().String(), res.ID, capOrPlaceholder)

	return ctx.JSON(http.StatusOK, dto.SendDocumentResponse{
		Key: dto.MessageResponseKey{
			RemoteJid: request.Number,
			FromMe:    true,
			Id:        res.ID,
		},
		Status:           "sent",
		MessageType:      "documentMessage",
		MessageTimestamp: int(res.CreatedAt.Unix() / 1000),
		InstanceId:       request.InstanceID,
	})
}

func (s *Message) SendImage(ctx echo.Context) error {
	var request dto.SendDocumentRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}

	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}

	return s.sendImage(ctx, request)
}

func (s *Message) sendImage(ctx echo.Context, request dto.SendDocumentRequest) error {
	jid, err := numberToJid(request.Number)
	if err != nil {
		zap.L().Error("error converting number to jid", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid number format")
	}

	sendData := &whatsmiau.SendImageRequest{
		InstanceID: request.InstanceID,
		MediaURL:   request.Media,
		Caption:    request.Caption,
		RemoteJID:  jid,
		Mimetype:   request.Mimetype,
	}

	c := ctx.Request().Context()
	time.Sleep(time.Millisecond * time.Duration(request.Delay)) // TODO: create a more robust solution

	res, err := s.whatsmiau.SendImage(c, sendData)
	if err != nil {
		zap.L().Error("Whatsmiau.SendDocument failed", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to send document")
	}
	capOrPlaceholder := request.Caption
	if capOrPlaceholder == "" {
		capOrPlaceholder = "[Imagem]"
	}
	s.whatsmiau.EnqueueSentMessage(request.InstanceID, jid.ToNonAD().String(), res.ID, capOrPlaceholder)

	return ctx.JSON(http.StatusOK, dto.SendDocumentResponse{
		Key: dto.MessageResponseKey{
			RemoteJid: request.Number,
			FromMe:    true,
			Id:        res.ID,
		},
		Status:           "sent",
		MessageType:      "imageMessage",
		MessageTimestamp: int(res.CreatedAt.Unix() / 1000),
		InstanceId:       request.InstanceID,
	})
}

func (s *Message) SendReaction(ctx echo.Context) error {
	var request dto.SendReactionRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}
	if request.InstanceID == "" {
		request.InstanceID = ctx.Param("instance")
		if request.InstanceID == "" {
			request.InstanceID = ctx.Param("id")
		}
	}

	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}

	jid, err := numberToJid(request.Key.RemoteJid)
	if err != nil {
		zap.L().Error("error converting number to jid", zap.Error(err))
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid number format")
	}

	// Reação deve ser não vazia e ter no máximo 10 runes (emoji único ou sequência)
	reactionRunes := []rune(request.Reaction)
	if len(reactionRunes) == 0 || len(reactionRunes) > 10 {
		return utils.HTTPFail(ctx, http.StatusBadRequest, nil, "reaction must be 1-10 characters")
	}

	sendReaction := &whatsmiau.SendReactionRequest{
		InstanceID: request.InstanceID,
		Reaction:   request.Reaction,
		RemoteJID:  jid,
		MessageID:  request.Key.Id,
		FromMe:     request.Key.FromMe,
	}
	if request.Key.Participant != "" {
		participantJid, errParticipant := numberToJid(request.Key.Participant)
		if errParticipant == nil {
			sendReaction.Participant = participantJid
		}
	}

	c := ctx.Request().Context()
	res, err := s.whatsmiau.SendReaction(c, sendReaction)
	if err != nil {
		zap.L().Error("Whatsmiau.SendReaction failed", zap.Error(err))
		services.RecordIncident(c, "message.send_reaction", "failed to send reaction", incidentOpts(ctx, request.InstanceID, "reaction", request, err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to send reaction")
	}

	return ctx.JSON(http.StatusOK, dto.SendReactionResponse{
		Key: dto.MessageResponseKey{
			RemoteJid: request.Key.RemoteJid,
			FromMe:    true,
			Id:        res.ID,
		},
		Status:           "sent",
		MessageType:      "reactionMessage",
		MessageTimestamp: int(res.CreatedAt.UnixMicro() / 1000),
		InstanceId:       request.InstanceID,
	})
}

func (s *Message) RevokeMessage(ctx echo.Context) error {
	var request dto.RevokeMessageRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}
	if request.InstanceID == "" {
		request.InstanceID = ctx.Param("instance")
		if request.InstanceID == "" {
			request.InstanceID = ctx.Param("id")
		}
	}
	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}
	jid, err := numberToJid(request.Key.RemoteJid)
	if err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid number format")
	}
	c := ctx.Request().Context()
	err = s.whatsmiau.RevokeMessage(c, request.InstanceID, jid, request.Key.Id, request.Key.FromMe)
	if err != nil {
		zap.L().Error("Whatsmiau.RevokeMessage failed", zap.Error(err))
		services.RecordIncident(c, "message.revoke", "failed to revoke message", incidentOpts(ctx, request.InstanceID, "revoke", request, err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to revoke message")
	}
	return ctx.JSON(http.StatusOK, map[string]string{"status": "revoked"})
}

func (s *Message) EditMessage(ctx echo.Context) error {
	var request dto.EditMessageRequest
	if err := ctx.Bind(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusUnprocessableEntity, err, "failed to bind request body")
	}
	if request.InstanceID == "" {
		request.InstanceID = ctx.Param("instance")
		if request.InstanceID == "" {
			request.InstanceID = ctx.Param("id")
		}
	}
	if err := validator.New().Struct(&request); err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid request body")
	}
	jid, err := numberToJid(request.Key.RemoteJid)
	if err != nil {
		return utils.HTTPFail(ctx, http.StatusBadRequest, err, "invalid number format")
	}
	c := ctx.Request().Context()
	res, err := s.whatsmiau.EditMessage(c, request.InstanceID, jid, request.Key.Id, request.Text)
	if err != nil {
		zap.L().Error("Whatsmiau.EditMessage failed", zap.Error(err))
		services.RecordIncident(c, "message.edit", "failed to edit message", incidentOpts(ctx, request.InstanceID, "edit", request, err))
		return utils.HTTPFail(ctx, http.StatusInternalServerError, err, "failed to edit message")
	}
	return ctx.JSON(http.StatusOK, map[string]any{
		"key":         dto.MessageResponseKey{RemoteJid: request.Key.RemoteJid, FromMe: true, Id: res.ID},
		"status":      "sent",
		"messageType": "conversation",
		"instanceId":  request.InstanceID,
	})
}

func incidentOpts(ctx echo.Context, instanceID, contextType string, payload interface{}, err error) *services.RecordIncidentOpts {
	opts := &services.RecordIncidentOpts{
		InstanceID:    instanceID,
		ContextType:   contextType,
		RequestPath:   ctx.Request().URL.Path,
		RequestMethod: ctx.Request().Method,
		Payload:       payload,
		ErrorDetail:   "",
	}
	if err != nil {
		opts.ErrorDetail = err.Error()
	}
	if uid, ok := ctx.Get("user_id").(string); ok && uid != "" {
		opts.UserID = uid
	}
	if cid, ok := ctx.Get("company_id").(string); ok && cid != "" {
		opts.CompanyID = cid
	}
	return opts
}
