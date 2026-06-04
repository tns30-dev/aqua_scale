# Notification Service Checklist

## Target

| Item | Selection |
|---|---|
| Language | Java |
| Framework | Spring Boot |
| Input | `reading.ingested` and related events |
| Database | Cloud SQL PostgreSQL |
| Cache | Redis/Memorystore for threshold lookup cache |
| Internal lookup | gRPC to Project Service and Pond Service |
| Realtime output | Pub/Sub events consumed by Realtime Gateway |

## Responsibilities

| Status | Responsibility | Output |
|---|---|---|
| [ ] | Consume `reading.ingested` | Alert evaluation triggered |
| [ ] | Load parameter thresholds | Project setting lookup |
| [ ] | Detect threshold violation | Violation result |
| [ ] | Deduplicate active alerts | Avoid alert storms |
| [ ] | Manage alert lifecycle | Created, acknowledged, resolved |
| [ ] | Store alert state | Cloud SQL records |
| [ ] | Publish alert events | Realtime and audit consumers notified |
| [ ] | Send notification request | Email/push/web notification path |
| [ ] | Record notification status | Sent/failed state |
| [ ] | Emit audit events | Alert and admin action audit |

## Data Ownership

| Entity/Table | Purpose |
|---|---|
| `alerts` | Current and historical alert state |
| `alert_log` | Alert/activity log |
| `notification_requests` or equivalent | Notification dispatch requests |
| `notification_delivery` or equivalent | Sent/failed delivery status |
| `outbox_events` if used | Reliable event publishing |

## REST API Checklist

| Status | Endpoint | Purpose |
|---|---|---|
| [ ] | `GET /api/alerts` | Alert search/list |
| [ ] | `GET /api/projects/{projectId}/alerts` | Project alert history |
| [ ] | `GET /api/ponds/{pondId}/alerts` | Pond alert history |
| [ ] | `POST /api/alerts/{alertId}/acknowledge` | Acknowledge alert |
| [ ] | `POST /api/alerts/{alertId}/resolve` | Resolve alert |
| [ ] | `GET /api/notifications` | Notification feed/history if implemented |

## Event Checklist

| Status | Event | Purpose |
|---|---|---|
| [ ] | `reading.ingested` | Input for alert detection |
| [ ] | `threshold.violated` | Internal/domain event |
| [ ] | `alert.created` | Realtime, audit, analytics |
| [ ] | `alert.resolved` | Realtime, audit, analytics |
| [ ] | `notification.requested` | Dispatch request |
| [ ] | `notification.sent` | Delivery success |
| [ ] | `notification.failed` | Delivery failure |
| [ ] | `audit.event.recorded` | Audit trail |

## Threshold Cache Checklist

| Status | Cache Entry | Invalidated By |
|---|---|---|
| [ ] | Project parameter thresholds | `project.settings.updated` |
| [ ] | Key parameter settings | `project.settings.updated` |
| [ ] | Alert suppression/dedup window | Alert lifecycle update |

## Test Checklist

| Status | Test | Expected Result |
|---|---|---|
| [ ] | Reading inside threshold | No alert created |
| [ ] | Reading outside threshold | Alert created |
| [ ] | Repeated violation | Deduplicated alert |
| [ ] | Resolve alert | Alert resolved and event published |
| [ ] | Threshold cache hit | Redis lookup visible |
| [ ] | Failed event processing | Message reaches DLQ |

