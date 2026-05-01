// Package phoneutil fornece utilitários para normalização e matching de
// números de telefone brasileiros, com foco em compatibilidade com JIDs
// do WhatsApp.
//
// Problema que este pacote resolve:
//
//	Um lead no banco pode ter o telefone armazenado em diversos formatos:
//	  "(48) 9 9999-9999", "+55 48 99999999", "48999999999", etc.
//	O WhatsApp entrega o número como JID: "5548999999999@s.whatsapp.net".
//	Para fazer o match, precisamos normalizar ambos os lados e gerar
//	variantes que cubram as inconsistências históricas de formato.
package phoneutil

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// reNonDigits remove qualquer caractere que não seja dígito (0-9).
var reNonDigits = regexp.MustCompile(`[^0-9]`)

// Normalize remove todos os caracteres não-numéricos de um telefone.
//
//	Normalize("(48) 9 9999-9999") → "48999999999"
//	Normalize("+55 48 99999-9999") → "5548999999999"
//	Normalize("48999999999")      → "48999999999"
func Normalize(phone string) string {
	return reNonDigits.ReplaceAllString(strings.TrimSpace(phone), "")
}

// StrictClean aplica as regras rígidas do WhatsMiau/CRM para garantir
// DDI 55, remover zeros à esquerda no DDD, e formatar corretamente.
func StrictClean(phone string) string {
	clean := Normalize(phone)
	if clean == "" {
		return ""
	}

	// Remove zero inicial do DDD (ex: 04899999999 -> 48999999999)
	// Geralmente o número com zero inicial terá 11 ou 12 dígitos.
	if len(clean) >= 11 && clean[0] == '0' {
		clean = clean[1:]
	}

	// Insere o DDI 55 se o número final for no formato DDD local (10 ou 11 dígitos)
	if (len(clean) == 10 || len(clean) == 11) && !strings.HasPrefix(clean, "55") {
		clean = "55" + clean
	}

	return clean
}

// NormalizeForWhatsApp aplica a "Regra de Ouro do 9º Dígito" para garantir
// compatibilidade total com a API do WhatsApp (WhatsMiau/Evolution).
//
// Regras aplicadas em ordem:
//  1. Remove todos os caracteres não-numéricos.
//  2. Remove zero à esquerda (ex: "048..." → "48...").
//  3. Garante o DDI 55.
//  4. Isola o DDD (2 dígitos após o 55).
//  5. DDDs ≤ 28 (SP/RJ/ES): se número local tiver 8 dígitos, insere o "9".
//  6. DDDs > 28 (demais estados, ex: SC/48, RS/51): se número local tiver
//     9 dígitos iniciando com "9", remove o dígito extra.
//
// Retorna erro se o número for vazio ou inválido (< 10 dígitos após limpeza).
func NormalizeForWhatsApp(phone string) (string, error) {
	clean := reNonDigits.ReplaceAllString(strings.TrimSpace(phone), "")
	if clean == "" {
		return "", fmt.Errorf("phoneutil: número vazio após limpeza")
	}

	// Remove zero à esquerda do DDD (ex: "04899999999" → "4899999999")
	if clean[0] == '0' {
		clean = clean[1:]
	}

	// Garante o DDI 55
	if !strings.HasPrefix(clean, "55") {
		clean = "55" + clean
	}

	// Após DDI, precisamos de pelo menos DDD(2) + número(8) = 12 dígitos totais.
	if len(clean) < 12 {
		return "", fmt.Errorf("phoneutil: número inválido (muito curto após normalização): %q", phone)
	}

	dddStr := clean[2:4]
	ddd, err := strconv.Atoi(dddStr)
	if err != nil {
		return "", fmt.Errorf("phoneutil: DDD inválido %q no número %q", dddStr, phone)
	}

	// Número local = tudo após DDI(2) + DDD(2)
	local := clean[4:]

	switch {
	case ddd <= 28 && len(local) == 8:
		// DDDs de SP/RJ/ES: número legado de 8 dígitos → insere o "9" obrigatório
		clean = "55" + dddStr + "9" + local

	case ddd > 28 && len(local) == 9 && local[0] == '9':
		// Demais DDDs (ex: SC/48, RS/51): remove o "9" extra incompatível com a API
		clean = "55" + dddStr + local[1:]
	}

	return clean, nil
}

// StripWAJID extrai a parte numérica de um JID do WhatsApp.
// Retorna string vazia para JIDs de grupo (@g.us) — o caller deve ignorar.
//
//	StripWAJID("5548999999999@s.whatsapp.net") → "5548999999999"
//	StripWAJID("5548999999999@c.us")           → "5548999999999"
//	StripWAJID("120363000000@g.us")            → ""  (grupo — ignorar)
func StripWAJID(jid string) string {
	// Grupos não representam leads individuais
	if strings.Contains(jid, "@g.us") {
		return ""
	}
	// JID pode ser "número@s.whatsapp.net" ou "número@c.us"
	at := strings.Index(jid, "@")
	if at < 0 {
		// Sem domínio: assume que é o próprio número
		return Normalize(jid)
	}
	return jid[:at]
}

// Variants gera todas as variantes normalizadas de um número brasileiro
// para maximizar a chance de encontrar um lead no banco, independentemente
// do formato em que o telefone foi cadastrado.
//
// Recebe o número já normalizado (apenas dígitos), preferencialmente com
// o DDI 55. Exemplos de entrada → saída (sem duplicatas):
//
//	"5548999999999"  → ["5548999999999", "48999999999", "999999999",
//	                    "4899999999", "99999999"]
//	"48999999999"    → ["48999999999", "999999999", "5548999999999",
//	                    "4899999999", "99999999"]
//
// Regras aplicadas:
//
//  1. Mantém o número como recebido.
//  2. Adiciona/remove o prefixo DDI "55" para cobrir ambos os casos.
//  3. Para números com 11 dígitos após remover DDI (DDD + 9 dígitos),
//     gera a variante sem o 9º dígito (formato legado pré-2012).
//  4. Para números com 10 dígitos após remover DDI (DDD + 8 dígitos),
//     gera a variante com o 9º dígito inserido (formato moderno).
//  5. Gera variante apenas com o número local (sem DDD), ambas versões.
func Variants(normalized string) []string {
	if normalized == "" {
		return nil
	}

	seen := make(map[string]struct{})
	add := func(s string) {
		if s != "" {
			seen[s] = struct{}{}
		}
	}

	// Garante que sempre temos o número sem DDI como ponto de partida
	withoutDDI := normalized
	if strings.HasPrefix(normalized, "55") && len(normalized) >= 12 {
		withoutDDI = normalized[2:]
		add(normalized) // com DDI: "5548999999999"
	} else {
		// Número chegou sem DDI — gera a versão com DDI também
		withDDI := "55" + normalized
		add(withDDI)
	}
	add(withoutDDI) // sem DDI: "48999999999" ou "48 99999999"

	// A partir daqui trabalhamos com withoutDDI = DDD + número
	switch len(withoutDDI) {
	case 11:
		// Formato moderno: DDD(2) + 9 + número(8) = 11 dígitos
		// Ex: "48999999999" → DDD="48", localWith9="999999999", localNo9="99999999"
		ddd := withoutDDI[:2]
		localWith9 := withoutDDI[2:] // "999999999"
		localNo9 := withoutDDI[3:]   // "99999999"  (remove o 9 inicial)
		add(localWith9)              // número local moderno
		add(ddd + localNo9)          // DDD + número legado: "4899999999"
		add(localNo9)                // número local legado

	case 10:
		// Formato legado: DDD(2) + número(8) = 10 dígitos
		// Ex: "4899999999" → DDD="48", local8="99999999"
		ddd := withoutDDI[:2]
		local8 := withoutDDI[2:] // "99999999"
		local9 := "9" + local8   // "999999999" (inserção do 9º dígito)
		add(local8)              // número local legado
		add(ddd + local9)        // DDD + número moderno: "48999999999"
		add("55" + ddd + local9) // com DDI + número moderno
		add(local9)              // número local moderno
	}

	result := make([]string, 0, len(seen))
	for k := range seen {
		result = append(result, k)
	}
	return result
}
