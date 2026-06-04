# Event-Driven Architecture Checklist

## Target

| Item | Selection |
|---|---|
| Internal event bus | Google Pub/Sub |
| Primary event format | JSON envelope with schema version |
| Failure handling | Dead-letter topics per important subscription |
| Consumers | Idempotent service consumers |
| Replay | Controlled repair/replay job |
| Audit linkage | Correlation IDs and trace IDs on events |

## Core Topics

| Status | Topic | Publisher | Main Consumers |
|---|---|---|---|
| [ ] | `iot.telemetry.received` | AWS Lambda bridge | Ingestion Service |
| [ ] | `sensor.message.validated` | Ingestion Service | Audit |
| [ ] | `sensor.message.rejected` | Ingestion Service | Audit |
| [ ] | `reading.ingested` | Ingestion Service | Notification, Realtime, Audit |
| [ ] | `reading.quarantined` | Ingestion Service | Audit |
| [ ] | `threshold.violated` | Notification Service | Audit, Realtime |
| [ ] | `alert.created` | Notification Service | Realtime, Audit |
| [ ] | `alert.resolved` | Notification Service | Realtime, Audit |
| [ ] | `notification.requested` | Notification Service | Notification dispatcher |
| [ ] | `notification.sent` | Notification dispatcher | Audit |
| [ ] | `audit.event.recorded` | All services | Audit Service |
| [ ] | `project.created` | Project Service | Audit |
| [ ] | `project.updated` | Project Service | Audit |
| [ ] | `project.settings.updated` | Project Service | Notification, Audit |
| [ ] | `device.registered` | Sensor Service | Audit |
| [ ] | `device.status.changed` | Sensor Service | Realtime, Audit |
| [ ] | `project.sensor.assigned` | Sensor Service | Ingestion, Audit |
| [ ] | `project.sensor.updated` | Sensor Service | Ingestion, Audit |

## Future Optional Topics

| Status | Topic | Publisher | Main Consumers |
|---|---|---|---|
| [ ] | `analytics.aggregate.requested` | Scheduler/API | Analytics Service |

Use this future topic only if Analytics implements materialized/precomputed aggregate jobs. It is not required for the first implementation because Analytics currently serves chart requests by reading chart config and telemetry stores directly.

## Event Envelope

| Field | Requirement |
|---|---|
| `eventId` | Required unique event ID |
| `eventType` | Required topic/domain event type |
| `schemaVersion` | Required |
| `occurredAt` | Required business timestamp |
| `publishedAt` | Required publisher timestamp |
| `source` | Required publisher service |
| `correlationId` | Required across request/event chain |
| `causationId` | Required when event is caused by another event |
| `tenant/projectId` | Required where project-scoped |
| `payload` | Required event-specific body |

## Consumer Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Create Pub/Sub topics | Topics visible |
| [ ] | Create subscriptions per service | Subscriptions visible |
| [ ] | Create DLQs | Dead-letter topics visible |
| [ ] | Configure max delivery attempts | Failed messages moved to DLQ |
| [ ] | Add idempotency key handling | Duplicate messages ignored |
| [ ] | Add schema validation | Invalid events rejected/quarantined |
| [ ] | Add retry-safe processing | Consumer restart safe |
| [ ] | Add structured logging | Event ID and correlation ID logged |
| [ ] | Add replay procedure | DLQ repair path documented |
| [ ] | Add event contract tests | Publisher/consumer contract checked |
| [ ] | Add monitoring alert on rejected/quarantined event volume | Operational visibility without a separate Operations service |

## Evidence Checklist

| Status | Evidence | Expected Result |
|---|---|---|
| [ ] | Valid telemetry event | Ingestion consumes successfully |
| [ ] | Duplicate event | Consumer ignores duplicate |
| [ ] | Invalid event | Message rejected or quarantined |
| [ ] | Forced consumer failure | Message reaches DLQ |
| [ ] | Replay demo | Fixed event reprocessed successfully |
