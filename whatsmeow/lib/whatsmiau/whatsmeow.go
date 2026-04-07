package whatsmiau

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/puzpuzpuz/xsync/v4"
	"github.com/verbeux-ai/whatsmiau/env"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/lib/storage/gcs"
	"github.com/verbeux-ai/whatsmiau/models"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	waLog "go.mau.fi/whatsmeow/util/log"
	"go.uber.org/zap"
	"golang.org/x/net/context"
)

// OnWebhookSentFunc is called after each webhook delivery (success or failure) for logging.
type OnWebhookSentFunc func(instanceID, companyID, eventType, url string, requestBody []byte, responseStatus int, responseBody []byte, err error)

type Whatsmiau struct {
	clients          *xsync.Map[string, *whatsmeow.Client]
	container        *sqlstore.Container
	logger           waLog.Logger
	repo             interfaces.InstanceRepository
	qrCache          *xsync.Map[string, string]
	observerRunning  *xsync.Map[string, bool]
	instanceCache    *xsync.Map[string, models.Instance]
	lockConnection   *xsync.Map[string, *sync.Mutex]
	emitter          chan emitter
	onWebhookSent    OnWebhookSentFunc
	chatJobChan      chan<- ChatJob // optional: enqueue chat jobs for async persistence
	httpClient       *http.Client
	fileStorage      interfaces.Storage
	handlerSemaphore chan struct{}
}

var instance *Whatsmiau
var mu = &sync.Mutex{}

func Get() *Whatsmiau {
	mu.Lock()
	defer mu.Unlock()
	return instance
}

func LoadMiau(ctx context.Context, container *sqlstore.Container, repo interfaces.InstanceRepository) {
	mu.Lock()
	defer mu.Unlock()
	deviceStore, err := container.GetAllDevices(ctx)
	if err != nil {
		panic(err)
	}

	level := "INFO"
	if env.Env.DebugWhatsmeow {
		level = "DEBUG"
	}

	instanceList, err := repo.List(ctx, "")
	if err != nil {
		zap.L().Fatal("failed to list instances", zap.Error(err))
	}

	instanceByRemoteJid := make(map[string]models.Instance)
	for _, inst := range instanceList {
		if len(inst.RemoteJID) <= 0 {
			continue
		}

		instanceByRemoteJid[inst.RemoteJID] = inst
	}

	clients := xsync.NewMap[string, *whatsmeow.Client]()

	clientLog := waLog.Stdout("Client", level, false)
	for _, device := range deviceStore {
		client := whatsmeow.NewClient(device, clientLog)
		if client.Store.ID == nil {
			zap.L().Error("device without id on db", zap.Any("device", device))
			continue
		}

		instanceFound, ok := instanceByRemoteJid[client.Store.ID.String()]
		if ok {
			configProxy(client, instanceFound.InstanceProxy)
			clients.Store(instanceFound.ID, client)
			if err := client.Connect(); err != nil {
				zap.L().Error("failed to connect connected device", zap.Error(err), zap.String("jid", client.Store.ID.String()))
			}
			continue
		}

		if err := client.Logout(context.TODO()); err != nil {
			zap.L().Error("failed to logout", zap.Error(err), zap.String("jid", client.Store.ID.String()))
		}
		if client.Store != nil && client.Store.ID != nil {
			if err := container.DeleteDevice(context.Background(), client.Store); err != nil {
				zap.L().Error("failed to delete device", zap.Error(err))
			}
		}
	}

	var storage interfaces.Storage
	if env.Env.GCSEnabled {
		storage, err = gcs.New(env.Env.GCSBucket)
		if err != nil {
			zap.L().Panic("failed to create GCS storage", zap.Error(err))
		}
	}

	instance = &Whatsmiau{
		clients:         clients,
		container:       container,
		logger:          clientLog,
		repo:            repo,
		qrCache:         xsync.NewMap[string, string](),
		instanceCache:   xsync.NewMap[string, models.Instance](),
		observerRunning: xsync.NewMap[string, bool](),
		lockConnection:  xsync.NewMap[string, *sync.Mutex](),
		emitter:         make(chan emitter, env.Env.EmitterBufferSize),
		httpClient: &http.Client{
			Timeout: time.Second * 30, // TODO: load from env
		},
		fileStorage:      storage,
		handlerSemaphore: make(chan struct{}, env.Env.HandlerSemaphoreSize),
	}
	// chatJobChan is set by main via SetChatJobChan() if chat persistence is enabled

	go instance.startEmitter()

	clients.Range(func(id string, client *whatsmeow.Client) bool {
		zap.L().Info("stating event handler", zap.String("jid", client.Store.ID.String()))
		client.AddEventHandler(instance.Handle(id))
		return true
	})

}

func (s *Whatsmiau) Connect(ctx context.Context, id string) (string, error) {
	zap.L().Info("[connect] starting connection flow", zap.String("instance", id))

	client, err := s.generateClient(ctx, id)
	if err != nil {
		zap.L().Error("[connect] generateClient failed", zap.String("instance", id), zap.Error(err))
		return "", err
	}
	if client == nil {
		zap.L().Info("[connect] already connected", zap.String("instance", id))
		return "", nil
	}

	if qr, ok := s.qrCache.Load(id); ok {
		zap.L().Debug("[connect] returning cached QR", zap.String("instance", id))
		return qr, nil
	}

	zap.L().Info("[connect] waiting for QR code generation", zap.String("instance", id))
	qrCode, err := s.observeAndQrCode(ctx, id, client)
	if err != nil {
		zap.L().Error("[connect] observeAndQrCode failed", zap.String("instance", id), zap.Error(err))
		return "", err
	}

	zap.L().Info("[connect] QR code generated successfully", zap.String("instance", id))
	return qrCode, nil
}

func (s *Whatsmiau) generateClient(ctx context.Context, id string) (*whatsmeow.Client, error) {
	lock, ok := s.lockConnection.Load(id)
	if !ok {
		lock = &sync.Mutex{}
		s.lockConnection.Store(id, lock)
	}
	lock.Lock()
	defer lock.Unlock()

	client, ok := s.clients.Load(id)
	if !ok {
		zap.L().Info("[generateClient] creating new device", zap.String("instance", id))
		device := s.container.NewDevice()
		client = whatsmeow.NewClient(device, s.logger)
		s.clients.Store(id, client)
	}

	if s.hasSomeDevice(client) {
		zap.L().Info("[generateClient] existing device found, attempting recovery",
			zap.String("instance", id),
			zap.Bool("logged_in", client.IsLoggedIn()),
			zap.Bool("connected", client.IsConnected()),
		)

		if instanceFound := s.getInstanceCached(id); instanceFound != nil {
			configProxy(client, instanceFound.InstanceProxy)
		}

		if client.IsLoggedIn() {
			return nil, nil
		}

		if err := client.Connect(); err == nil {
			if client.IsLoggedIn() {
				return nil, nil
			}
		} else {
			zap.L().Warn("[generateClient] recovery connect failed", zap.String("instance", id), zap.Error(err))
		}

		zap.L().Info("[generateClient] cleaning stale device", zap.String("instance", id))
		s.clients.Delete(id)
		if err := s.deleteDeviceIfExists(ctx, client); err != nil {
			zap.L().Error("[generateClient] hard logout failed", zap.String("instance", id), zap.Error(err))
			return nil, err
		}

		device := s.container.NewDevice()
		client = whatsmeow.NewClient(device, s.logger)
		s.clients.Store(id, client)
		zap.L().Info("[generateClient] fresh client created", zap.String("instance", id))
	}

	return client, nil
}

func (s *Whatsmiau) hasSomeDevice(client *whatsmeow.Client) bool {
	noStore := client.Store == nil
	if noStore {
		return false
	}

	noDevice := client.Store.ID == nil
	if noDevice {
		return false
	}

	return true
}

func (s *Whatsmiau) observeConnection(client *whatsmeow.Client, id string) {
	if _, ok := s.observerRunning.Load(id); ok {
		zap.L().Debug("observer connection already running", zap.String("id", id))
		return
	}

	zap.L().Debug("starting observer connection", zap.String("id", id))
	s.observerRunning.Store(id, true)
	defer func() {
		zap.L().Debug("stopping observer connection", zap.String("id", id))
		s.observerRunning.Delete(id)
		s.qrCache.Delete(id)
		s.lockConnection.Delete(id)
	}()

	ctx, cancel := context.WithTimeout(context.TODO(), time.Minute*2)
	qrChan, err := client.GetQRChannel(ctx)
	if err != nil {
		zap.L().Error("failed to observe QR Code", zap.Error(err))
		s.clients.Delete(id)
		if err := s.deleteDeviceIfExists(context.TODO(), client); err != nil {
			zap.L().Error("failed to cleanup device after GetQRChannel error", zap.String("id", id), zap.Error(err))
		}
		return
	}

	if instanceFound := s.getInstance(id); instanceFound != nil {
		configProxy(client, instanceFound.InstanceProxy)
	}
	if err := client.Connect(); err != nil {
		zap.L().Error("failed to connect connected device", zap.Error(err))
		s.clients.Delete(id)
		if err := s.deleteDeviceIfExists(context.TODO(), client); err != nil {
			zap.L().Error("failed to cleanup device after Connect error", zap.String("id", id), zap.Error(err))
		}
		return
	}

	zap.L().Debug("waiting for QR channel event", zap.String("id", id))
	for {
		select {
		case <-ctx.Done(): // QR code expiration
			zap.L().Debug("context ", zap.String("id", id), zap.Error(ctx.Err()))
			if err := s.deleteDeviceIfExists(context.TODO(), client); err != nil {
				zap.L().Error("failed to hard logout", zap.String("id", id), zap.Error(err))
			}
			s.clients.Delete(id)
			return
		case evt, ok := <-qrChan:
			if !ok || evt.Event == "error" || evt.Event == "timeout" { // closed qr chan
				zap.L().Debug("QR channel closed", zap.String("id", id), zap.Any("evt", evt))
				cancel()
				continue
			}
			zap.L().Debug("received QR channel event", zap.String("id", id), zap.Any("evt", evt))
			if evt.Event == "code" {
				s.qrCache.Store(id, evt.Code)
				continue
			}

			if evt.Event == "success" || evt.Event == "logged_in" {
				if client.Store.ID == nil {
					zap.L().Error("jid is nil after login", zap.String("id", id), zap.Any("evt", evt))
					cancel()
					continue
				}

				zap.L().Info("device connected successfully", zap.String("id", id))
				client.RemoveEventHandlers()
				client.AddEventHandler(s.Handle(id))
				if _, err := s.repo.Update(context.Background(), id, &models.Instance{
					RemoteJID: client.Store.ID.String(),
				}); err != nil {
					zap.L().Error("failed to update instance after login", zap.Error(err))
				}
				// Webhook CONNECTED
				if inst := s.getInstance(id); inst != nil && inst.Webhook.Url != "" && webhookEventEnabled(inst.Webhook.Events, "CONNECTED") {
					companyID := ""
					if inst.CompanyID != nil {
						companyID = *inst.CompanyID
					}
					s.EmitEnvelope(inst.ID, companyID, "connected", inst.Webhook.Url, inst.Webhook.Secret, map[string]string{"timestamp": time.Now().UTC().Format(time.RFC3339)})
				}
				s.qrCache.Delete(id)
				return
			}

			zap.L().Error("unknown event", zap.String("id", id), zap.Any("evt", evt))
		}
	}
}

func (s *Whatsmiau) observeAndQrCode(ctx context.Context, id string, client *whatsmeow.Client) (string, error) {
	const qrWaitTimeout = 45 * time.Second
	ctx, cancel := context.WithTimeout(ctx, qrWaitTimeout)
	defer cancel()

	zap.L().Info("[observeAndQrCode] waiting up to 45s for QR", zap.String("instance", id))
	go s.observeConnection(client, id)

	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	start := time.Now()
	for {
		select {
		case <-ticker.C:
			qrCode, ok := s.qrCache.Load(id)
			if ok && len(qrCode) > 0 {
				zap.L().Info("[observeAndQrCode] QR ready",
					zap.String("instance", id),
					zap.Duration("elapsed", time.Since(start)),
				)
				return qrCode, nil
			}
		case <-ctx.Done():
			zap.L().Error("[observeAndQrCode] timeout reached",
				zap.String("instance", id),
				zap.Duration("elapsed", time.Since(start)),
				zap.Error(ctx.Err()),
			)
			return "", ctx.Err()
		}
	}
}

func (s *Whatsmiau) deleteDeviceIfExists(ctx context.Context, client *whatsmeow.Client) error {
	if client.IsLoggedIn() {
		if err := client.Logout(ctx); err != nil {
			zap.L().Error("failed to logout", zap.Error(err))
			return err
		}
	}

	if client.Store != nil && client.Store.ID != nil {
		if err := s.container.DeleteDevice(ctx, client.Store); err != nil {
			zap.L().Error("failed to delete device", zap.Error(err))
			return err
		}
	}

	return nil
}

func (s *Whatsmiau) Status(id string) (Status, error) {
	client, ok := s.clients.Load(id)
	if !ok {
		return Closed, nil
	}

	if client.IsConnected() && client.IsLoggedIn() {
		return Connected, nil
	}

	// If not connected, but we have a QR code, the state is QrCode
	if _, ok := s.qrCache.Load(id); ok && client.IsConnected() {
		return QrCode, nil
	}

	if client.IsLoggedIn() {
		return Connecting, nil
	}

	return Closed, nil
}

func (s *Whatsmiau) Logout(ctx context.Context, id string) error {
	client, ok := s.clients.Load(id)
	if !ok {
		zap.L().Warn("logout: client does not exist", zap.String("id", id))
		return nil
	}

	s.clients.Delete(id)
	return s.deleteDeviceIfExists(ctx, client)
}

func (s *Whatsmiau) Disconnect(id string) error {
	// Webhook DISCONNECTED on manual disconnect
	if inst := s.getInstance(id); inst != nil && inst.Webhook.Url != "" && webhookEventEnabled(inst.Webhook.Events, "DISCONNECTED") {
		companyID := ""
		if inst.CompanyID != nil {
			companyID = *inst.CompanyID
		}
		s.EmitEnvelope(inst.ID, companyID, "disconnected", inst.Webhook.Url, inst.Webhook.Secret, map[string]string{"timestamp": time.Now().UTC().Format(time.RFC3339)})
	}

	client, ok := s.clients.Load(id)
	if !ok {
		zap.L().Warn("failed to disconnect (device not loaded)", zap.String("id", id))
		return nil
	}

	client.Disconnect()
	s.qrCache.Delete(id)
	return nil
}

// SetChatJobChan sets the channel for async chat persistence. If set, handleMessageEvent and handleReceiptEvent will enqueue jobs.
func (s *Whatsmiau) SetChatJobChan(ch chan<- ChatJob) {
	s.chatJobChan = ch
}

// SetOnWebhookSent registers a callback invoked after each webhook delivery for logging (e.g. webhook_logs).
func (s *Whatsmiau) SetOnWebhookSent(f OnWebhookSentFunc) {
	s.onWebhookSent = f
}

// EnqueueSentMessage enqueues a job for a message sent by the user (so it gets persisted and broadcast). Call after successful SendText.
func (s *Whatsmiau) EnqueueSentMessage(instanceID, remoteJid, waMessageID, text string) {
	if s.chatJobChan == nil {
		return
	}
	ts := int(time.Now().Unix())
	job := ChatJob{
		Type:       "message",
		InstanceID: instanceID,
		MessageData: &WookMessageData{
			Key: &WookKey{
				RemoteJid: remoteJid,
				Id:        waMessageID,
				FromMe:    true,
			},
			PushName:         "",
			Status:           "sent",
			MessageType:      "conversation",
			MessageTimestamp: ts,
			Message:          &WookMessageRaw{Conversation: text},
		},
	}
	select {
	case s.chatJobChan <- job:
	default:
		zap.L().Warn("chat job queue full, dropping sent message job", zap.String("instance", instanceID))
	}
}

func (s *Whatsmiau) GetJidLid(ctx context.Context, id string, jid types.JID) (string, string) {
	newJid, newLid := s.extractJidLid(ctx, id, jid)
	if strings.HasSuffix(newJid, "@lid") {
		newLid = newJid
	}

	return newJid, newLid
}

func (s *Whatsmiau) extractJidLid(ctx context.Context, id string, jid types.JID) (string, string) {
	client, ok := s.clients.Load(id)
	if !ok {
		return jid.ToNonAD().String(), ""
	}

	if jid.Server == types.DefaultUserServer {
		lid, err := client.Store.LIDs.GetLIDForPN(ctx, jid)
		if err != nil {
			zap.L().Warn("failed to get lid from store", zap.String("id", id), zap.Error(err))
		}

		return jid.ToNonAD().String(), lid.ToNonAD().String()
	}

	if jid.Server == types.HiddenUserServer {
		lidString := jid.ToNonAD().String()
		pnJID, err := client.Store.LIDs.GetPNForLID(ctx, jid)
		if err != nil {
			zap.L().Warn("failed to get pn for lid", zap.Stringer("lid", jid), zap.Error(err))
			return jid.ToNonAD().String(), lidString
		}

		if !pnJID.IsEmpty() {
			return pnJID.ToNonAD().String(), lidString
		}

		return lidString, lidString
	}

	return jid.ToNonAD().String(), ""
}
