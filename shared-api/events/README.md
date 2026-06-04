# Pub/Sub Event Contracts

Event schemas use a shared envelope shape:

| Field | Rule |
|---|---|
| `eventId` | Unique idempotency key |
| `eventType` | Must match the schema/topic domain event |
| `schemaVersion` | `v1` for these files |
| `occurredAt` | Business event timestamp |
| `publishedAt` | Publisher timestamp |
| `source` | Publishing service/component |
| `correlationId` | Request/event trace correlation |
| `causationId` | Optional parent event/request |
| `projectId` | Required for project-scoped events |
| `pondId` | Required for pond-scoped events |
| `payload` | Event-specific body |

## Topic Catalogue

| Topic | Schema | Publisher | Consumers | DLQ |
|---|---|---|---|---|
| `iot.telemetry.received` | `iot.telemetry.received.v1.json` | AWS Lambda bridge | Ingestion | `iot.telemetry.received.dlq` |
| `sensor.message.validated` | `sensor.message.validated.v1.json` | Ingestion | Audit | `sensor.message.validated.dlq` |
| `sensor.message.rejected` | `sensor.message.rejected.v1.json` | Ingestion | Audit | `sensor.message.rejected.dlq` |
| `reading.ingested` | `reading.ingested.v1.json` | Ingestion | Notification, Realtime, Audit | `reading.ingested.dlq` |
| `reading.quarantined` | `reading.quarantined.v1.json` | Ingestion | Audit | `reading.quarantined.dlq` |
| `threshold.violated` | `threshold.violated.v1.json` | Notification | Realtime, Audit | `threshold.violated.dlq` |
| `alert.created` | `alert.created.v1.json` | Notification | Realtime, Audit | `alert.created.dlq` |
| `alert.resolved` | `alert.resolved.v1.json` | Notification | Realtime, Audit | `alert.resolved.dlq` |
| `notification.requested` | `notification.requested.v1.json` | Notification | Dispatcher | `notification.requested.dlq` |
| `notification.sent` | `notification.sent.v1.json` | Dispatcher | Audit | `notification.sent.dlq` |
| `audit.event.recorded` | `audit.event.recorded.v1.json` | All services | Audit | `audit.event.recorded.dlq` |

## Validation

Run:

```bash
find shared-api/events -name '*.json' -print0 | xargs -0 -n1 jq empty
```
