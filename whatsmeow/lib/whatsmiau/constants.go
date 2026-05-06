package whatsmiau

type Status string

const (
	Connected    = "open"
	Connecting   = "connecting"
	Reconnecting = "reconnecting"
	QrCode       = "qr-code"
	Closed       = "closed"
)
