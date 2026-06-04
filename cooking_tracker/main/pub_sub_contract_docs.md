# Pub/Sub Contract Documentation

## Target

| Item | Selection |
|---|---|
| Event bus | Google Pub/Sub |
| Event format | JSON envelope |
| Schema management | Versioned event schema files |
| Failure path | DLQ per important subscription |
| Consumer model | Idempotent consumers |

## Event Envelope

| Field | Required | Notes |
|---|---|---|
| `eventId` | Yes | Unique event ID |
| `eventType` | Yes | Domain event name |
| `schemaVersion` | Yes | Versioned payload schema |
| `occurredAt` | Yes | Business event timestamp |
| `publishedAt` | Yes | Publish timestamp |
| `source` | Yes | Publishing service |
| `correlationId` | Yes | Cross-service trace correlation |
| `causationId` | No | Event/request that caused this event |
| `projectId` | If project-scoped | Project ownership |
| `pondId` | If pond-scoped | Pond ownership |
| `payload` | Yes | Event-specific body |

## Topic Contract Checklist

| Status | Topic | Publisher | Subscriber | DLQ |
|---|---|---|---|---|
| [ ] | `iot.telemetry.received` | AWS Lambda bridge | Ingestion | `iot.telemetry.received.dlq` |
| [ ] | `sensor.message.validated` | Ingestion | Audit | `sensor.message.validated.dlq` |
| [ ] | `sensor.message.rejected` | Ingestion | Audit | `sensor.message.rejected.dlq` |
| [ ] | `reading.ingested` | Ingestion | Notification, Realtime, Audit | `reading.ingested.dlq` |
| [ ] | `reading.quarantined` | Ingestion | Audit | `reading.quarantined.dlq` |
| [ ] | `threshold.violated` | Notification | Realtime, Audit | `threshold.violated.dlq` |
| [ ] | `alert.created` | Notification | Realtime, Audit | `alert.created.dlq` |
| [ ] | `alert.resolved` | Notification | Realtime, Audit | `alert.resolved.dlq` |
| [ ] | `notification.requested` | Notification | Dispatcher | `notification.requested.dlq` |
| [ ] | `notification.sent` | Dispatcher | Audit | `notification.sent.dlq` |
| [ ] | `audit.event.recorded` | All services | Audit | `audit.event.recorded.dlq` |

## Future Optional Topic Contract

| Status | Topic | Publisher | Subscriber | DLQ |
|---|---|---|---|---|
| [ ] | `analytics.aggregate.requested` | Scheduler/API | Analytics | `analytics.aggregate.requested.dlq` |

This optional Analytics topic is only for future precomputed aggregate jobs. It is not part of the first event-consumer scope.

## Event Schema File Checklist

| Status | Event | Schema File |
|---|---|---|
| [ ] | `iot.telemetry.received` | `shared-api/events/iot.telemetry.received.v1.json` |
| [ ] | `reading.ingested` | `shared-api/events/reading.ingested.v1.json` |
| [ ] | `alert.created` | `shared-api/events/alert.created.v1.json` |
| [ ] | `alert.resolved` | `shared-api/events/alert.resolved.v1.json` |
| [ ] | `audit.event.recorded` | `shared-api/events/audit.event.recorded.v1.json` |

## Operational Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Define retry attempts | Subscription config |
| [ ] | Define ack deadline | Subscription config |
| [ ] | Define DLQ topic | Subscription failure target |
| [ ] | Define replay process | Repair job or manual command |
| [ ] | Define idempotency key | Consumer duplicate handling |
| [ ] | Define schema compatibility rule | Backward-compatible event evolution |
| [ ] | Define monitoring alerts for rejected/quarantined event volume | Operations visibility through monitoring, not a separate Operations service |
