package whatsmiau

import (
	"fmt"
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
		return "ALREADY_CONNECTED", nil
	}

	if qr, ok := s.qrCache.Load(id); ok {
		zap.L().Debug("[connect] returning cached QR", zap.String("instance", id))
		return qr, nil
	}

	// Start observer in background (non-blocking)
	if _, alreadyRunning := s.observerRunning.Load(id); !alreadyRunning {
		zap.L().Info("[connect] launching observer goroutine", zap.String("instance", id))
		s.observerRunning.Store(id, true)
		go s.observeConnection(client, id)
	}

	// Short optimistic wait — return QR if it arrives quickly
	return s.waitForQRCode(id, 3*time.Second)
}

// GetCachedQR returns the cached QR code string for a given instance, if available.
// Designed for lightweight polling from HTTP handlers.
func (s *Whatsmiau) GetCachedQR(id string) (string, bool) {
	return s.qrCache.Load(id)
}

// IsObserverRunning reports whether a QR observer goroutine is active for the instance.
func (s *Whatsmiau) IsObserverRunning(id string) bool {
	_, running := s.observerRunning.Load(id)
	return running
}

func (s *Whatsmiau) generateClient(ctx context.Context, id string) (*whatsmeow.Client, error) {
	lock, ok := s.lockConnection.Load(id)
	if !ok {
		lock = &sync.Mutex{}
		s.lockConnection.Store(id, lock)
	}
	lock.Lock()
	defer lock.Unlock()

	// If the QR observer goroutine is active for this instance, it owns the connection
	// lifecycle. Interfering here (e.g. deleting the device) races with post-pairing
	// goroutines (pre-key upload, identity key storage) and causes FK violations.
	if _, observing := s.observerRunning.Load(id); observing {
		if client, ok := s.clients.Load(id); ok {
			return client, nil
		}
		return nil, nil
	}

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
			// Login is asynchronous: handleConnectSuccess fires after the server sends <success>.
			// Deleting the device immediately while that goroutine is still running (uploading
			// pre-keys, storing identity keys) causes FK violations in child tables.
			// Poll for up to 8 seconds so we catch the logged-in state before deciding to wipe.
			for i := 0; i < 16; i++ {
				if client.IsLoggedIn() {
					return nil, nil
				}
				time.Sleep(500 * time.Millisecond)
			}
			zap.L().Warn("[generateClient] connect succeeded but login timed out", zap.String("instance", id))
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
	zap.L().Debug("starting observer connection", zap.String("id", id))
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

	maxAttempts := 3
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		zap.L().Info("Tentativa de conexão para instância", zap.Int("attempt", attempt), zap.String("id", id))
		if err := client.Connect(); err == nil {
			zap.L().Info("Conectado ao WebSocket do WhatsApp", zap.String("id", id))
			break
		} else {
			zap.L().Error("Falha na tentativa de conexão", zap.Error(err), zap.Int("attempt", attempt), zap.String("id", id))
			if attempt == maxAttempts {
				zap.L().Error("Todas as tentativas de conexão falharam, removendo dispositivo", zap.String("id", id))
				s.clients.Delete(id)
				if err := s.deleteDeviceIfExists(context.TODO(), client); err != nil {
					zap.L().Error("failed to cleanup device after Connect error", zap.String("id", id), zap.Error(err))
				}
				return
			}
			backoff := time.Duration(1<<(attempt-1)) * time.Second
			zap.L().Info("Aguardando para nova tentativa", zap.Duration("backoff", backoff), zap.String("id", id))
			time.Sleep(backoff)
		}
	}

	zap.L().Debug("waiting for QR channel event", zap.String("id", id))
	for {
		select {
		case <-ctx.Done(): // QR code expiration or timeout
			zap.L().Warn("QR observation timed out or context cancelled", zap.String("id", id), zap.Error(ctx.Err()))
			if err := s.deleteDeviceIfExists(context.TODO(), client); err != nil {
				zap.L().Error("failed to hard logout on timeout", zap.String("id", id), zap.Error(err))
			}
			s.clients.Delete(id)
			return
		case evt, ok := <-qrChan:
			if !ok {
				zap.L().Warn("QR channel closed unexpectedly", zap.String("id", id))
				cancel()
				continue
			}

			zap.L().Info("received QR channel event", zap.String("id", id), zap.String("event", evt.Event))

			switch evt.Event {
			case "code":
				zap.L().Debug("storing new QR code in cache", zap.String("id", id))
				s.qrCache.Store(id, evt.Code)
			case "pairing":
				zap.L().Info("pairing in progress...", zap.String("id", id))
			case "timeout":
				zap.L().Warn("QR channel timed out", zap.String("id", id))
				cancel()
			case "error":
				zap.L().Error("QR channel error", zap.String("id", id), zap.Any("evt", evt))
				cancel()
			case "success", "logged_in":
				if client.Store.ID == nil {
					zap.L().Error("jid is nil after login", zap.String("id", id), zap.Any("evt", evt))
					cancel()
					continue
				}

				zap.L().Info("Handshake concluído, aguardando sincronização inicial...", zap.String("id", id))

				if err := client.Store.Save(context.Background()); err != nil {
					zap.L().Error("failed to save device store to SQL", zap.String("id", id), zap.Error(err))
				}

				time.Sleep(2 * time.Second)

				zap.L().Info("device connected successfully", zap.String("id", id), zap.String("jid", client.Store.ID.String()))
				
				// Ensure event handlers are set
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
				zap.L().Info("QR observation finished with success", zap.String("id", id))
				return
			default:
				zap.L().Debug("unhandled QR event", zap.String("id", id), zap.String("event", evt.Event), zap.Any("raw", evt))
			}
		}
	}
}

// waitForQRCode polls the QR cache for a short duration and returns the code
// as soon as it appears. If the timeout expires, it returns an empty string
// without error — the caller should treat this as "still generating".
func (s *Whatsmiau) waitForQRCode(id string, timeout time.Duration) (string, error) {
	ticker := time.NewTicker(150 * time.Millisecond)
	defer ticker.Stop()

	deadline := time.NewTimer(timeout)
	defer deadline.Stop()

	for {
		select {
		case <-ticker.C:
			if qr, ok := s.qrCache.Load(id); ok && len(qr) > 0 {
				return qr, nil
			}
		case <-deadline.C:
			return "", nil
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

	connected := client.IsConnected()
	loggedIn := client.IsLoggedIn()

	if connected && loggedIn {
		return Connected, nil
	}

	// If not connected, but we have a QR code, the state is QrCode
	if _, ok := s.qrCache.Load(id); ok {
		if connected {
			return QrCode, nil
		}
		// If we have QR but not connected, it's still QrCode but might be reconnecting
		return QrCode, nil 
	}

	if loggedIn {
		// If logged in but not connected, try to connect if it's not a temporary drop
		if !connected {
			zap.L().Warn("Instância logada mas desconectada", zap.String("id", id))
			return Reconnecting, nil
		}
		return Connecting, nil
	}

	// If it's connected but not logged in (and no QR), it's generating/connecting
	if connected {
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

func (s *Whatsmiau) SendPresence(ctx context.Context, instanceID string, remoteJid string, presence string) error {
	client, ok := s.clients.Load(instanceID)
	if !ok {
		return fmt.Errorf("instance not found: %s", instanceID)
	}

	jid, err := types.ParseJID(remoteJid)
	if err != nil {
		return fmt.Errorf("invalid jid: %w", err)
	}

	state := types.ChatPresence(presence)
	return client.SendChatPresence(ctx, jid, state, types.ChatPresenceMediaText)
}
