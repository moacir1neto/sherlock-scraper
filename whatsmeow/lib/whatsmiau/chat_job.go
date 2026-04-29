package whatsmiau

// ChatJob is sent to the chat persistence queue so workers can persist and broadcast without blocking the event handler.
type ChatJob struct {
	Type          string                  // "message" or "receipt"
	InstanceID    string                  // instance id
	MessageData   *WookMessageData        // set when Type == "message"
	ReceiptEvents []WookMessageUpdateData // set when Type == "receipt"
}
