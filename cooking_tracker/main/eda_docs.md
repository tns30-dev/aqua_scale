# Event-Driven Architecture Documentation

## Mermaid Diagram

```mermaid
flowchart LR
  Device[Pi or Simulator] --> IoT[AWS IoT Core MQTT]
  IoT --> Lambda[AWS Lambda Bridge]
  Lambda --> T1[iot.telemetry.received]
  T1 --> Ingestion[Ingestion Service]

  Ingestion --> T2[sensor.message.validated]
  Ingestion --> T3[sensor.message.rejected]
  Ingestion --> T4[reading.ingested]
  Ingestion --> T5[reading.quarantined]

  T4 --> Notification[Notification Service]
  T4 --> Realtime[Realtime Gateway]
  T4 --> Audit[Audit Service]

  Notification --> T6[threshold.violated]
  Notification --> T7[alert.created]
  Notification --> T8[alert.resolved]
  Notification --> T9[notification.requested]

  T7 --> Realtime
  T8 --> Realtime
  T6 --> Audit
  T7 --> Audit
  T8 --> Audit
  T9 --> Dispatcher[Notification Dispatcher]
  Dispatcher --> T10[notification.sent]
  T10 --> Audit

  T2 --> Audit
  T3 --> Audit
  T5 --> Audit

  Project[Project Service] --> P1[project.created]
  Project --> P2[project.updated]
  Project --> P3[project.settings.updated]
  P1 --> Audit
  P2 --> Audit
  P3 --> Notification
  P3 --> Audit

  Sensor[Sensor Service] --> S1[device.registered]
  Sensor --> S2[device.status.changed]
  Sensor --> S3[project.sensor.assigned]
  Sensor --> S4[project.sensor.updated]
  S1 --> Audit
  S2 --> Realtime
  S2 --> Audit
  S3 --> Ingestion
  S3 --> Audit
  S4 --> Ingestion
  S4 --> Audit
```

## Contract Checklist

| Status | Item | Output |
|---|---|---|
| [ ] | Topic catalogue | Topic list with owners |
| [ ] | Subscription catalogue | Subscription list with consumers |
| [ ] | Event envelope definition | Required shared fields |
| [ ] | Event payload schemas | Schema per event type |
| [ ] | DLQ mapping | DLQ per important subscription |
| [ ] | Retry policy | Delivery attempts and replay rules |
| [ ] | Idempotency policy | Idempotency keys per event |
| [ ] | Audit correlation | Event IDs, correlation IDs, trace IDs |

## DLQ Checklist

| Status | Subscription | DLQ |
|---|---|---|
| [ ] | Ingestion on `iot.telemetry.received` | `iot.telemetry.received.dlq` |
| [ ] | Notification on `reading.ingested` | `reading.ingested.dlq` |
| [ ] | Realtime on `alert.created` | `alert.created.dlq` |
| [ ] | Audit on audit events | `audit.event.recorded.dlq` |
| [ ] | Notification on `project.settings.updated` | `project.settings.updated.dlq` |
| [ ] | Audit on Project events | `project.created.dlq`, `project.updated.dlq`, `project.settings.updated.dlq` |
| [ ] | Ingestion on Sensor mapping events | `project.sensor.assigned.dlq`, `project.sensor.updated.dlq` |
| [ ] | Audit on Sensor events | `device.registered.dlq`, `device.status.changed.dlq`, `project.sensor.assigned.dlq`, `project.sensor.updated.dlq` |

## Evidence Checklist

| Status | Evidence | Expected Result |
|---|---|---|
| [ ] | Published valid event | Consumer processes event |
| [ ] | Published invalid event | Event rejected or DLQ path triggered |
| [ ] | Duplicate event | Consumer remains idempotent |
| [ ] | DLQ replay | Repaired event reprocessed |
| [ ] | Event diagram rendered | Mermaid diagram included in report |
