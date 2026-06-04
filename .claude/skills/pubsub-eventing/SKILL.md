---
name: pubsub-eventing
description: Use when building event-driven flows on Google Pub/Sub — creating topics/subscriptions/DLQs, the JSON event envelope, versioned event schemas in contracts/events/, idempotent consumers, transactional outbox, replay/repair, and event contract tests. Trigger on "publish event", "consume", "topic", "DLQ", "idempotency", "event schema", "outbox", "replay".
---

# Pub/Sub eventing (specs: `main/eda.md`, `main/eda_docs.md`, `main/pub_sub_contract_docs.md`)

## Decided topic catalogue (don't invent topics — extend the spec doc first)

| Topic | Publisher | Consumers |
|---|---|---|
| `iot.telemetry.received` | AWS Lambda bridge | Ingestion |
| `sensor.message.validated` / `.rejected` | Ingestion | Audit |
| `reading.ingested` | Ingestion | Notification, Realtime, Audit |
| `reading.quarantined` | Ingestion | Audit |
| `threshold.violated` | Notification | Realtime, Audit |
| `alert.created` / `alert.resolved` | Notification | Realtime, Audit |
| `notification.requested` | Notification | Dispatcher |
| `notification.sent` | Dispatcher | Audit |
| `audit.event.recorded` | All services | Audit |

Every important subscription gets a DLQ named `<topic>.dlq` with max-delivery-attempts.
Subscription naming: `<service>.<topic>.sub`.

## Event envelope (required on every event)

`eventId` · `eventType` · `schemaVersion` · `occurredAt` · `publishedAt` · `source` ·
`correlationId` · `causationId` (when event-caused) · `projectId`/`pondId` (when scoped) ·
`payload`. Implement once as a shared envelope class/serializer per language.

## Schemas

Versioned JSON Schema files at `contracts/events/<eventType>.v1.json` (minimum set:
`iot.telemetry.received`, `reading.ingested`, `alert.created`, `alert.resolved`,
`audit.event.recorded`). Evolution must be backward-compatible; breaking change = new
`vN` file + new `schemaVersion`. Validate on publish (tests) and on consume (runtime —
invalid → reject/quarantine, never crash-loop).

## Consumer pattern (every consumer)

1. Validate envelope + schema → invalid: reject/quarantine event + log.
2. **Idempotency check** (stable key, e.g. `eventId` or domain key like `deviceId+seqNo`)
   → duplicate: ack + ignore (Redis or unique-constraint based).
3. Process in a retry-safe way (restart-safe, no partial side effects without outbox).
4. Failure → nack; Pub/Sub retries; exhausted → DLQ. Alert on DLQ/quarantine volume.
5. Log `eventId` + `correlationId` structured; propagate correlation into downstream calls.

## Publisher pattern

- State change + event must not diverge: where consistency matters (e.g. Ingestion
  persist + `reading.ingested`), use a **transactional outbox** (DB table + relay) or
  accept at-least-once with idempotent consumers — document the choice per service.
- Always set the full envelope; never publish raw domain objects.

## Replay / repair

DLQ → inspect → fix cause → re-publish repaired event to the original topic via a small
repair script/job. Document the runbook; the spec requires a replay demo as evidence.

## Tests & evidence

Contract tests: publisher serializes valid-against-schema; consumer accepts valid + routes
invalid to reject path. Emulator-based integration tests (Testcontainers). Evidence set:
valid-event flow, duplicate ignored, invalid rejected, forced failure → DLQ, replay demo.
Update `cooking_tracker/claude/data_and_messaging_tracker.md` after milestones.
