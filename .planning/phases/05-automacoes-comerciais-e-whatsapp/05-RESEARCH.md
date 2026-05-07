# Phase 5: Automações Comerciais e WhatsApp - Research

**Researched:** 2026-05-06
**Domain:** WhatsApp automation, conversational AI, Asynq task orchestration, Redis, PostgreSQL
**Confidence:** HIGH (all findings verified against live codebase)

---

## Summary

Phase 5 extends the event-driven notification system built in Phase 4 into a full outbound WhatsApp automation loop. The backend already has the core primitives: `business_events` table, Asynq scheduler, `sendViaWhatsMiau` HTTP helper, and the `EventPayloadV1` versioned payload contract. What is missing is the inbound reply path (WhatsMiau webhook → backend), conversation memory storage, AI intent classification, hybrid message templates, and the operational guardrails that prevent the system from spamming or annoying leads.

The most architecturally significant decision is **where conversation memory lives**. Redis (short-lived, fast) and PostgreSQL (durable, queryable) serve different needs: Redis is ideal for the active context window passed to Gemini; PostgreSQL is essential for compliance history and multi-turn replay. Both are needed and their roles must not overlap.

The second most important decision is **AI call volume**. Each inbound reply must trigger intent classification (1 Gemini call). Hybrid templates must trigger message generation (1 Gemini call per outbound). These two calls are the budget ceiling — all other operations (guardrail checks, scheduling decisions) must be pure logic in Go with no LLM calls.

**Primary recommendation:** Implement a new Asynq task type `whatsapp:reply-received` as the single entry point for all inbound WhatsMiau webhook events. This task reads conversation memory from Redis, classifies intent with Gemini, executes guardrail logic in pure Go, persists the turn to PostgreSQL, and either schedules a reply task or triggers handoff.

---

## Project Constraints (from CLAUDE.md)

- AI model: `gemini-2.5-flash` — DO NOT change. Note: `callGeminiGeneric` in `tasks.go` currently uses `gemini-2.0-flash` (hardcoded string). Phase 5 code must use the constant `dossierLLMModel = "gemini-2.5-flash"` or define a shared package-level constant.
- WhatsMiau communication: backend → WhatsMiau exclusively via HTTP REST. Never call WhatsMiau internals directly.
- Frontend priority: WhatsMiau panel (`whatsmeow/frontend/`) takes priority over Sherlock panel (`frontend/`) for any UI work.
- No changes to `whatsmeow/` internals when working on backend features.
- Short sentences, no padding. Execute tools first, show result, then stop.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Inbound reply ingestion | WhatsMiau (webhook receiver) | Backend API (webhook forwarder) | WhatsMiau owns the WhatsApp session; it must be the entry point for all incoming messages |
| Intent classification | Backend (Asynq worker) | — | CPU-bound LLM call; must not block WhatsMiau webhook response |
| Conversation memory read/write | Backend (Asynq worker) | — | Backend owns the PostgreSQL conversation_turns table and Redis context cache |
| Hybrid template generation | Backend (Asynq worker) | — | Gemini call + static base; outbound send via WhatsMiau HTTP |
| Guardrail enforcement | Backend (Asynq worker) | — | Pure Go logic; enforces max_reschedules, handoff conditions |
| Delivery status tracking | Backend (business_events update) | — | Status field on business_events already exists (PENDING/SENT/FAILED) |
| Human handoff signal | Backend → WhatsMiau HTTP | WhatsMiau (chat assignment) | Backend signals handoff; WhatsMiau executes assignment to human agent |
| Anti-spam window | Backend (Redis TTL key) | — | Simple Redis key per lead with TTL; checked before any outbound send |

---

## Standard Stack

### Core (all already installed in the project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `github.com/hibiken/asynq` | already used | Task queue, retry, scheduling | Already the project standard; supports `RetryDelayFunc`, `MaxRetry`, `SkipRetry` |
| `github.com/go-redis/redis/v8` | already used | Redis client for Pub/Sub and key-value | Already the project standard |
| `gorm.io/gorm` | already used | PostgreSQL ORM | Already the project standard; used for all persistence |
| Gemini REST API (`gemini-2.5-flash`) | REST | Intent classification, template generation | Project-mandated model |

### New Tables Required

| Table | Purpose |
|-------|---------|
| `conversation_turns` | Durable per-lead conversation history (all turns, all time) |
| `whatsapp_deliveries` | Per-message delivery tracking linked to business_events |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| Redis string key `conv:context:{lead_id}` | Active context window (last N turns as JSON) | Pass to Gemini on every intent classification call |
| Redis string key `antispam:{lead_id}` with TTL | Anti-spam window gate | Check before every outbound send |
| Redis string key `reschedule_count:{event_id}` | Reschedule attempt counter | Increment on each reschedule; compare against max |

---

## Architecture Patterns

### System Architecture Diagram

```
WhatsMiau receives incoming WhatsApp reply
  |
  v
WhatsMiau webhook handler calls:
  POST /api/v1/internal/whatsapp/reply  (backend Sherlock)
  |
  v
Backend HTTP handler (InternalAuth middleware)
  - Validates X-Internal-Token
  - Enqueues Asynq task: whatsapp:reply-received
  - Returns 202 Accepted immediately
  |
  v
Asynq Worker: HandleWhatsAppReplyTask
  |
  +---> 1. Load conversation context from Redis (conv:context:{lead_id})
  |
  +---> 2. Classify intent via Gemini (1 LLM call)
  |         Returns: CONFIRM | RESCHEDULE | OBJECTION | HANDOFF | UNKNOWN
  |
  +---> 3. Persist turn to PostgreSQL (conversation_turns)
  |
  +---> 4. Apply guardrails (pure Go, no LLM):
  |         - Is reschedule count >= max? → force HANDOFF
  |         - Is antispam window active? → suppress outbound
  |         - Is sentiment HANDOFF? → force HANDOFF
  |
  +---> 5a. Intent = CONFIRM
  |         Update business_event status → CONFIRMED
  |         No outbound message needed
  |
  +---> 5b. Intent = RESCHEDULE
  |         Increment reschedule_count in Redis
  |         Generate new proposed time (rule-based, no LLM)
  |         Enqueue: whatsapp:send-message (outbound task)
  |
  +---> 5c. Intent = OBJECTION
  |         Generate empathetic response via Gemini (template fill)
  |         Enqueue: whatsapp:send-message (outbound task)
  |
  +---> 5d. Intent = HANDOFF
  |         POST /v1/internal/handoff to WhatsMiau (assign to human)
  |         Update business_event status → HANDOFF
  |
  +---> 5e. Intent = UNKNOWN
  |         Log and suppress (no outbound)

Asynq Worker: HandleSendWhatsAppMessageTask
  |
  +---> 1. Check antispam Redis key (TTL gate)
  +---> 2. sendViaWhatsMiau (existing helper, reused)
  +---> 3. Update whatsapp_deliveries record
  +---> 4. Set antispam Redis key with TTL
  +---> 5. Update business_event status → SENT
```

### Recommended Project Structure (new files only)

```
backend/
├── internal/
│   ├── core/domain/
│   │   ├── conversation_turn.go      # ConversationTurn entity
│   │   └── whatsapp_delivery.go      # WhatsAppDelivery entity
│   ├── core/ports/
│   │   └── conversation_repository.go
│   ├── handlers/
│   │   └── whatsapp_webhook.go       # POST /internal/whatsapp/reply
│   ├── repositories/
│   │   └── conversation_repository.go
│   ├── services/
│   │   ├── intent_classifier.go      # Gemini intent classification
│   │   └── template_service.go       # Hybrid template generation
│   └── queue/
│       ├── whatsapp_reply_task.go    # HandleWhatsAppReplyTask
│       └── whatsapp_send_task.go     # HandleSendWhatsAppMessageTask
└── pkg/events/
    └── types.go                      # Add new EventType constants here
```

### Pattern 1: Asynq Task with Exponential Backoff for WhatsApp Sends

The existing codebase uses `asynq.MaxRetry(3)` with default backoff. Asynq supports a custom `RetryDelayFunc` at the server config level to implement exponential backoff.

```go
// Source: [VERIFIED: codebase - backend/internal/queue/server.go]
// Add to asynq.Config in StartServer():
asynq.Config{
    Concurrency: 5,
    Queues: map[string]int{
        "critical":  6,
        "default":   3,
        "whatsapp":  4,  // new dedicated queue
        "low":       1,
    },
    RetryDelayFunc: func(n int, e error, t *asynq.Task) time.Duration {
        // Exponential backoff: 30s, 2m, 8m, 32m, 2h
        return time.Duration(30*(1<<uint(n))) * time.Second
    },
}
```

Task creation with WhatsApp-specific retry limit:

```go
// [VERIFIED: codebase pattern from tasks.go]
asynq.NewTask(TaskTypeWhatsAppSend, data,
    asynq.MaxRetry(5),
    asynq.Queue("whatsapp"),
    asynq.Unique(10*time.Minute), // deduplication within 10 min
)
```

### Pattern 2: Conversation Memory — Two-Layer Architecture

```go
// Layer 1: Redis context window (fast, ephemeral, last 10 turns)
// Key: conv:context:{lead_id}
// Value: JSON array of {role, content, timestamp}
// TTL: 30 days (auto-expire inactive conversations)

// Layer 2: PostgreSQL conversation_turns (durable, queryable)
// Used for: compliance, handoff context display, LLM re-hydration after Redis eviction
```

Schema for `conversation_turns`:

```sql
-- [ASSUMED] — schema design based on project patterns
CREATE TABLE conversation_turns (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID NOT NULL REFERENCES leads(id),
    company_id  UUID NOT NULL,
    direction   VARCHAR(10) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    content     TEXT NOT NULL,
    intent      VARCHAR(20),  -- classified intent for INBOUND turns
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON conversation_turns (lead_id, created_at DESC);
CREATE INDEX ON conversation_turns (company_id, created_at DESC);
```

### Pattern 3: Hybrid Template — Static Base + Gemini Fill

Minimize LLM calls by keeping the structural template in Go and calling Gemini only for the dynamic "tone fill" portion:

```go
// [VERIFIED: pattern derived from existing callGeminiGeneric and dossierLLMModel]
// Base template (static, no LLM):
const meetingReminderBase = `Olá {{.LeadName}}! Passando para confirmar nossa reunião amanhã às {{.Time}}.`

// Gemini only fills "tone adaptation" — not the full message:
// Input: base message + lead context (business_type, tone from DeepData.Insights)
// Output: adapted message (same content, adjusted register)
// This reduces prompt size and cost vs. generating from scratch
```

**When to skip Gemini:** If `DeepData.Insights` is nil or `Insights.Tone` is empty, send the static base without LLM enrichment. Never block message delivery waiting for LLM.

### Pattern 4: Intent Classification Prompt (Low-Token)

```
// [ASSUMED] — prompt design
Classify this WhatsApp reply into exactly one of: CONFIRM, RESCHEDULE, OBJECTION, HANDOFF, UNKNOWN.
Reply with only the classification word, nothing else.

Context: The lead had a meeting scheduled. The AI sent a reminder.
Lead reply: "{{.ReplyText}}"
```

Single-word output eliminates JSON parsing overhead and minimizes output tokens.

### Pattern 5: Guardrail State in Redis

```go
// Anti-spam: key antispam:{lead_id}, TTL = configured window (e.g., 4h)
// If key exists → suppress outbound, log suppression

// Reschedule counter: key reschedule_count:{event_id}
// Increment on each RESCHEDULE intent
// If value >= maxReschedules (e.g., 3) → force HANDOFF regardless of intent

// Both keys must be set/read atomically where possible (INCR + EXPIRE in pipeline)
```

### Anti-Patterns to Avoid

- **Calling Gemini inside the webhook HTTP handler:** WhatsMiau expects a fast response. Always enqueue an Asynq task and return 202.
- **Storing conversation memory only in Redis:** Redis can evict or restart. PostgreSQL is the source of truth.
- **Generating the full message from scratch with Gemini every time:** Use static templates with Gemini filling only the dynamic segment. Reduces latency and cost.
- **Using `gemini-2.0-flash` in new code:** The project mandates `gemini-2.5-flash`. The old `callGeminiGeneric` function has a bug (uses `gemini-2.0-flash` hardcoded). New tasks must use the `dossierLLMModel` constant or define a shared constant in `pkg/events` or a new `pkg/llm` package.
- **Blocking message delivery on LLM failure:** If Gemini call fails, fall back to static template and proceed with delivery.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Task retry + backoff | Custom retry loop | Asynq `MaxRetry` + `RetryDelayFunc` | Asynq already handles persistence, visibility, dead-letter |
| Deduplication of reply tasks | Custom dedup logic | `asynq.Unique(duration)` | Built-in task uniqueness by type+payload hash |
| Distributed TTL-based anti-spam | Go timer + in-memory map | Redis key with `SET NX EX` | Survives restarts, works across multiple workers |
| Task cancellation | Custom cancel signal | `Inspector.DeleteTask` + `Inspector.CancelProcessing` | Already proven in `asynqScheduler.Cancel` |
| Phone normalization | Custom regex | `phoneutil.NormalizeForWhatsApp` | Already exists in `backend/pkg/phoneutil` |
| WhatsMiau send | New HTTP client | `sendViaWhatsMiau` (reuse from `tasks.go`) | Already handles auth, timeout, error classification |

---

## Common Pitfalls

### Pitfall 1: callGeminiGeneric Uses Wrong Model
**What goes wrong:** `tasks.go` has `callGeminiGeneric` hardcoded to `gemini-2.0-flash`. If Phase 5 reuses this function, it violates the project rule.
**Why it happens:** The function was written before the project standardized on `gemini-2.5-flash`.
**How to avoid:** Define a shared constant in `pkg/llm` or `pkg/events`: `const DefaultLLMModel = "gemini-2.5-flash"`. All LLM callers reference this constant.
**Warning signs:** Grep for `gemini-2.0-flash` in new files — should return zero results.

### Pitfall 2: WhatsMiau Webhook Timeout
**What goes wrong:** If the backend handler does synchronous work (DB write, LLM call) before returning, WhatsMiau webhook times out and retries, causing duplicate processing.
**Why it happens:** Treating the webhook as a synchronous pipeline.
**How to avoid:** Handler does only: validate auth → enqueue Asynq task → return 202. All processing happens in the Asynq worker.

### Pitfall 3: Conversation Memory Race Condition
**What goes wrong:** Two concurrent tasks for the same lead (e.g., a reminder send and an inbound reply) both read Redis context, modify it, and write back — last write wins.
**Why it happens:** No locking on Redis context key.
**How to avoid:** Use Redis `WATCH` + optimistic transaction for context updates, or serialize all per-lead reply processing through a per-lead Asynq queue using `asynq.TaskID` uniqueness.

### Pitfall 4: Reschedule Counter Not Persisted
**What goes wrong:** Redis restarts → reschedule counter lost → lead gets more reschedule attempts than allowed.
**Why it happens:** Storing guardrail state only in Redis.
**How to avoid:** Mirror reschedule count in `whatsapp_deliveries` or a dedicated column on `business_events` (e.g., `reschedule_count INT`). Redis is the fast path; PostgreSQL is the authoritative value.

### Pitfall 5: company_id Isolation at Worker Level
**What goes wrong:** A worker fetches conversation turns for `lead_id` without scoping by `company_id`. In a multi-tenant system this is a data leak risk.
**Why it happens:** Worker only has `lead_id` in the task payload.
**How to avoid:** Always include `company_id` in every Asynq task payload (already established in `EventPayloadV1`). Every DB query in workers must include `WHERE company_id = ?`.

---

## Code Examples

### Reusing sendViaWhatsMiau (existing, verified)

```go
// Source: [VERIFIED: backend/internal/queue/tasks.go line 251]
// Signature already handles auth header, timeout, error classification
func sendViaWhatsMiau(ctx context.Context, instanceID, phone, text string) error
// Call site example:
if err := sendViaWhatsMiau(ctx, instanceID, phone, message); err != nil {
    return err // retryable — Asynq will retry with backoff
}
```

### Asynq Task Registration Pattern (existing)

```go
// Source: [VERIFIED: backend/internal/queue/server.go line 56-59]
mux.HandleFunc(TaskTypeEnrichLead, HandleEnrichLeadTask)
mux.HandleFunc(events.TaskMeetingReminder, HandleMeetingReminderTask)
// New tasks follow the same pattern:
mux.HandleFunc(TaskTypeWhatsAppReply, HandleWhatsAppReplyTask)
mux.HandleFunc(TaskTypeWhatsAppSend, HandleSendWhatsAppMessageTask)
```

### EventPayloadV1 Extension Pattern (existing)

```go
// Source: [VERIFIED: backend/pkg/events/types.go]
// Add new event types to existing constants block:
const (
    TypeMeetingScheduled EventType = "MEETING_SCHEDULED"
    // ...existing...
    TypeWhatsAppReplied  EventType = "WHATSAPP_REPLIED"   // new
    TypeHandoffTriggered EventType = "HANDOFF_TRIGGERED"  // new
)

// New task type constants (add to types.go or tasks.go):
const (
    TaskWhatsAppReply = "whatsapp:reply-received"
    TaskWhatsAppSend  = "whatsapp:send-message"
)
```

### Redis Anti-Spam Pattern

```go
// Source: [ASSUMED] — standard Redis NX+EX pattern
func (w *whatsappWorker) checkAndSetAntiSpam(ctx context.Context, leadID string, window time.Duration) (blocked bool, err error) {
    key := fmt.Sprintf("antispam:%s", leadID)
    set, err := w.redis.SetNX(ctx, key, "1", window).Result()
    if err != nil {
        return false, err
    }
    // SetNX returns false if key already existed (blocked)
    return !set, nil
}
```

---

## Runtime State Inventory

> Not a rename/refactor phase — no runtime state migration required.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Generate full message with LLM | Static base + LLM tone fill only | 60-70% fewer output tokens per message [ASSUMED] |
| Store chat history in-memory | Redis (active window) + PostgreSQL (durable) | Survives restarts; supports handoff context |
| asynq.MaxRetry with default backoff | Custom `RetryDelayFunc` in server config | Prevents hammering WhatsMiau during outages |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 60-70% token reduction from hybrid template vs full generation | State of the Art | Actual savings depend on template length and Gemini output verbosity; benchmark needed |
| A2 | `conversation_turns` schema design (columns, indexes) | Architecture Patterns | Minor — can be adjusted before migration runs |
| A3 | Anti-spam TTL of 4h and max 3 reschedules as default guardrail values | Common Pitfalls | Business decision — planner should confirm with user |
| A4 | Single-word intent classification output eliminates JSON parsing overhead | Architecture Patterns | Gemini may add prose despite the instruction; planner should add a fallback parser |
| A5 | WhatsMiau has a `/v1/internal/handoff` endpoint or equivalent for chat assignment | Architecture Diagram | Must be verified against WhatsMiau codebase before implementing handoff task |

---

## Open Questions

1. **WhatsMiau handoff endpoint**
   - What we know: WhatsMiau owns chat assignment to human agents
   - What's unclear: Does an HTTP endpoint exist for the backend to trigger assignment (`POST /v1/internal/handoff`)? The `whatsmeow/server/controllers/handoff_sse.go` file exists — its API contract is unknown.
   - Recommendation: Read `handoff_sse.go` before designing the handoff task payload.

2. **WhatsMiau instance_id for outbound sends**
   - What we know: `sendViaWhatsMiau` requires `instanceID`; bulk campaigns pass it in the task payload
   - What's unclear: For automated reminders triggered by `business_events`, where does `instance_id` come from? The event payload does not currently include it.
   - Recommendation: Add `instance_id` field to `EventPayloadV1.Metadata` at event creation time, or derive it from a company settings lookup.

3. **Gemini intent classification fallback**
   - What we know: If Gemini returns something other than the expected single word, the system breaks
   - Recommendation: Always wrap intent parsing in a function that maps any unrecognized output to `UNKNOWN`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis | Asynq, Pub/Sub, antispam keys | Already running | 6379 (docker) | — |
| PostgreSQL | conversation_turns, whatsapp_deliveries | Already running | 5434 (docker) | — |
| WhatsMiau API | sendViaWhatsMiau HTTP calls | Already running | 8081 (docker) | — |
| Gemini REST API | Intent classification, template fill | External (API key in env) | gemini-2.5-flash | Fall back to static template |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test files found in `backend/` |
| Config file | none — Wave 0 gap |
| Quick run command | `cd backend && go test ./... -run TestWhatsApp -timeout 30s` |
| Full suite command | `cd backend && go test ./... -timeout 120s` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WAPP-01 | Hybrid template generates message with static base + Gemini fill | unit | `go test ./internal/services/ -run TestTemplateService` | Wave 0 |
| WAPP-01 | Static fallback used when Gemini fails | unit | `go test ./internal/services/ -run TestTemplateFallback` | Wave 0 |
| WAPP-02 | RESCHEDULE intent triggers new time proposal and outbound task | unit | `go test ./internal/queue/ -run TestWhatsAppReplyReschedule` | Wave 0 |
| WAPP-03 | Reschedule count >= max triggers forced HANDOFF | unit | `go test ./internal/queue/ -run TestGuardrailMaxReschedule` | Wave 0 |
| WAPP-03 | Anti-spam window suppresses outbound | unit | `go test ./internal/queue/ -run TestAntiSpamWindow` | Wave 0 |
| WAPP-04 | Conversation turns persisted to PostgreSQL | unit | `go test ./internal/repositories/ -run TestConversationRepository` | Wave 0 |
| WAPP-04 | Redis context window loaded and passed to Gemini | unit | `go test ./internal/queue/ -run TestContextWindowLoad` | Wave 0 |

### Wave 0 Gaps
- [ ] `backend/internal/services/template_service_test.go` — covers WAPP-01
- [ ] `backend/internal/queue/whatsapp_reply_task_test.go` — covers WAPP-02, WAPP-03, WAPP-04
- [ ] `backend/internal/repositories/conversation_repository_test.go` — covers WAPP-04
- [ ] No Go test framework config needed — `go test` is built-in

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `InternalAuth` middleware (`X-Internal-Token`) already on internal routes |
| V3 Session Management | no | Stateless Asynq tasks |
| V4 Access Control | yes | `company_id` scoping on all DB queries in workers |
| V5 Input Validation | yes | Validate inbound webhook payload before enqueue; sanitize reply text before LLM prompt |
| V6 Cryptography | no | No new secrets; existing token auth pattern is sufficient |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via lead reply | Tampering | Wrap reply text in delimiters in prompt; classify only, never execute |
| Replay attack on internal webhook | Spoofing | `X-Internal-Token` header validation (already in `InternalAuth` middleware) |
| LLM output injection (malicious message sent to lead) | Tampering | Validate generated message against allowed length and character set before send |
| Unbounded conversation turns storage | DoS | Enforce max rows per lead in `conversation_turns` (e.g., 1000); archive older turns |

---

## Sources

### Primary (HIGH confidence — verified against live codebase)
- `backend/internal/queue/tasks.go` — `sendViaWhatsMiau`, `HandleBulkMessageTask`, retry patterns, `SkipRetry` usage
- `backend/internal/queue/server.go` — Asynq server config, queue definitions, middleware pattern
- `backend/internal/queue/notification_tasks.go` — `HandleMeetingReminderTask`, worker pattern for business events
- `backend/internal/queue/dossier_service.go` — `dossierLLMModel = "gemini-2.5-flash"`, Gemini REST call pattern
- `backend/internal/core/domain/business_event.go` — existing schema with all fields
- `backend/internal/services/event_service.go` — event creation, reminder scheduling, cancellation pattern
- `backend/internal/infrastructure/scheduler/asynq_scheduler.go` — Schedule/Cancel via Asynq Inspector
- `backend/pkg/events/types.go` — `EventPayloadV1`, event type constants, status constants
- `backend/internal/repositories/business_event_repository.go` — repository pattern (Create/GetByID/Update/ListByLead)
- `.planning/phases/4-CONTEXT.md` — Phase 4 architectural decisions (Redis Pub/Sub channel, SSE pattern, company_id isolation requirement)

### Secondary (MEDIUM confidence)
- `whatsmeow/server/controllers/lead_sse.go` — WhatsMiau Redis subscription pattern, `NotificationsChannel` constant, phone normalization utilities

### Tertiary (LOW confidence)
- A3, A4, A5 in Assumptions Log — business thresholds and WhatsMiau internal endpoints not verified in this session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies required
- Architecture: HIGH — patterns derived directly from live codebase; new components follow existing conventions
- Pitfalls: HIGH — bugs identified from direct code reading (gemini-2.0-flash, race condition)
- Guardrail thresholds: LOW — business values (max_reschedules=3, antispam TTL=4h) are assumptions

**Research date:** 2026-05-06
**Valid until:** 2026-06-05 (30 days — stable Go/Asynq ecosystem)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WAPP-01 | Templates Híbridos (Fixos + IA) | Pattern 3 (Hybrid Template) documents static base + Gemini tone fill; `callGeminiGeneric` pattern reused from `tasks.go`; fallback to static when Gemini fails |
| WAPP-02 | Reagendamento Automático (Cenários Simples) | `whatsapp:reply-received` task handles RESCHEDULE intent; reschedule count tracked in Redis + mirrored to PostgreSQL; new time proposed via rule-based logic (no LLM) |
| WAPP-03 | Safety Guardrails & Handoff Humano | Redis reschedule counter + antispam key implement operational limits; HANDOFF intent triggers WhatsMiau HTTP call; all guardrail checks are pure Go (no LLM cost) |
| WAPP-04 | Memória Conversacional | Two-layer: Redis active context window (last N turns) + PostgreSQL `conversation_turns` table (durable); context loaded before every Gemini call |
</phase_requirements>
