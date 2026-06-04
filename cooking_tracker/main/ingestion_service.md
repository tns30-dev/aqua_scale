# Ingestion Service Checklist

## Target

| Item | Selection |
|---|---|
| Language | Java |
| Framework | Spring Boot |
| Input | Google Pub/Sub subscription on `iot.telemetry.received` |
| Internal lookup | gRPC to Sensor Service |
| Raw telemetry store | Cloud Bigtable target; cost-safe fallback allowed |
| Parsed reading store | PostgreSQL partitioned/demo store or Bigtable target |
| Output events | `reading.ingested`, `reading.quarantined`, validation events |

## Responsibilities

| Status | Responsibility | Output |
|---|---|---|
| [ ] | Consume normalized IoT events | Pub/Sub consumer |
| [ ] | Validate event envelope | Schema/version check |
| [ ] | Validate sensor payload | Parameter/value/range structure |
| [ ] | Verify application HMAC/signature | Payload integrity check |
| [ ] | Verify replay/idempotency | Duplicate protection |
| [ ] | Resolve device/port mapping | Project/pond/projectSensor context |
| [ ] | Store raw message | Bigtable or fallback store |
| [ ] | Store parsed readings | Operational reading records |
| [ ] | Publish success event | `reading.ingested` |
| [ ] | Publish quarantine/reject event | `reading.quarantined` or `sensor.message.rejected` |
| [ ] | Emit audit events | Validation/persistence audit |

## Pub/Sub Checklist

| Status | Topic/Subscription | Purpose |
|---|---|---|
| [ ] | `iot.telemetry.received` | Input topic |
| [ ] | `ingestion.iot.telemetry.received.sub` | Ingestion subscription |
| [ ] | `iot.telemetry.received.dlq` | Failed input DLQ |
| [ ] | `sensor.message.validated` | Validation success |
| [ ] | `sensor.message.rejected` | Validation failure |
| [ ] | `reading.ingested` | Parsed reading persisted |
| [ ] | `reading.quarantined` | Suspicious/unusable reading |

## Validation Checklist

| Status | Check | Action On Failure |
|---|---|---|
| [ ] | Required envelope fields | Reject/quarantine |
| [ ] | Required payload fields | Reject/quarantine |
| [ ] | Known device | Reject/quarantine |
| [ ] | Known device/port mapping | Reject/quarantine |
| [ ] | Valid measured timestamp | Reject/quarantine |
| [ ] | Monotonic or acceptable `seqNo` | Reject duplicate/replay |
| [ ] | HMAC/signature valid | Reject/quarantine |
| [ ] | Parameter codes known | Reject unknown parameter or quarantine |
| [ ] | Value type/range sane | Quarantine if suspicious |

## Persistence Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Define idempotency key | Stable duplicate detection |
| [ ] | Define raw Bigtable row key | Time-series storage key |
| [ ] | Define parsed reading model | Queryable operational reading |
| [ ] | Add transactional outbox if needed | Persist + event consistency |
| [ ] | Add batch write where useful | Higher throughput |
| [ ] | Add controlled fallback store | Cost-safe demo path |

## Test Checklist

| Status | Test | Expected Result |
|---|---|---|
| [ ] | Valid telemetry event | Reading persisted and event published |
| [ ] | Duplicate `seqNo` | Duplicate ignored |
| [ ] | Invalid signature | Message rejected/quarantined |
| [ ] | Unknown device | Message rejected/quarantined |
| [ ] | Pub/Sub retry failure | Message moves to DLQ |
| [ ] | gRPC Sensor lookup failure | Message retried or quarantined safely |

