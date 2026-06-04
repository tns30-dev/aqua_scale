# Audit Service Checklist

## Target

| Item | Selection |
|---|---|
| Language | Java |
| Framework | Spring Boot |
| Input | Pub/Sub audit events |
| Database | Cloud SQL PostgreSQL append-only tables |
| Long-term archive | BigQuery or Cloud Storage future option |
| Platform logs | Cloud Logging remains separate |

## Responsibilities

| Status | Responsibility | Output |
|---|---|---|
| [ ] | Consume audit events | Pub/Sub consumer |
| [ ] | Validate audit envelope | Required fields checked |
| [ ] | Store append-only records | Immutable audit table |
| [ ] | Correlate with trace IDs | Link to Cloud Logging traces |
| [ ] | Expose admin audit queries | Search/filter REST API |
| [ ] | Support security event review | Login, access, admin changes |
| [ ] | Support business event review | Project, pond, sensor, alert changes |
| [ ] | Export cold archive if needed | BigQuery/GCS export |

## Audit Event Fields

| Field | Requirement |
|---|---|
| `auditId` | Required |
| `eventType` | Required |
| `actorUserId` | Required for user actions |
| `serviceName` | Required |
| `projectId` | Required for project-scoped actions |
| `resourceType` | Required |
| `resourceId` | Required where applicable |
| `action` | Required |
| `outcome` | Required |
| `occurredAt` | Required |
| `correlationId` | Required |
| `traceId` | Required where available |
| `metadata` | Optional structured context |

## REST API Checklist

| Status | Endpoint | Purpose |
|---|---|---|
| [ ] | `GET /api/audit/events` | Search audit events |
| [ ] | `GET /api/audit/events/{auditId}` | Audit event detail |
| [ ] | `GET /api/audit/projects/{projectId}` | Project audit trail |
| [ ] | `GET /api/audit/users/{userId}` | User action trail |
| [ ] | `GET /api/audit/security` | Security-relevant events |

## Event Checklist

| Status | Event | Source |
|---|---|---|
| [ ] | `audit.event.recorded` | All services |
| [ ] | `login.succeeded` audit payload | Identity Service |
| [ ] | `login.failed` audit payload | Identity Service |
| [ ] | `project.updated` audit payload | Project Service |
| [ ] | `pond.updated` audit payload | Pond Service |
| [ ] | `device.updated` audit payload | Sensor Service |
| [ ] | `alert.resolved` audit payload | Notification Service |

## Test Checklist

| Status | Test | Expected Result |
|---|---|---|
| [ ] | Valid audit event | Stored once |
| [ ] | Duplicate audit event | Idempotent handling |
| [ ] | Missing required field | Event rejected/DLQ |
| [ ] | Admin query by project | Filtered records returned |
| [ ] | Trace correlation | Trace ID visible in audit record |

