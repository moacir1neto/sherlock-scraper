package sse

import "github.com/digitalcombo/sherlock-scraper/backend/internal/core/ports"

// CompositeBroadcaster implementa ports.SSEBroadcaster fazendo fan-out para
// múltiplos broadcasters. Permite notificar simultaneamente o Hub in-memory
// (Sherlock CRM) e o RedisBroadcaster (WhatsMeow) com uma única chamada.
type CompositeBroadcaster struct {
	broadcasters []ports.SSEBroadcaster
}

// NewCompositeBroadcaster aceita qualquer número de broadcasters e retorna
// um broadcaster composto que publica para todos eles na ordem recebida.
func NewCompositeBroadcaster(bs ...ports.SSEBroadcaster) *CompositeBroadcaster {
	return &CompositeBroadcaster{broadcasters: bs}
}

// Publish distribui o evento para cada broadcaster registrado.
func (c *CompositeBroadcaster) Publish(data string) {
	for _, b := range c.broadcasters {
		b.Publish(data)
	}
}
