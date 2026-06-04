# Polyglot Persistence Checklist

## Target Store Ownership

| Store | Purpose | Main Owners |
|---|---|---|
| Cloud SQL PostgreSQL | Transactional business data | Identity, Project, Pond, Sensor, Notification, Audit |
| Cloud SQL read replica | Read-heavy non-critical queries | Project, Pond, Notification, Analytics |
| Cloud Bigtable | Target operational telemetry/time-series store | Ingestion, Analytics |
| BigQuery | Target historical analytics warehouse | Analytics, ML future |
| Redis/Memorystore | Cache, rate limit, realtime fanout, subscriptions | API edge, Project, Sensor, Realtime, Notification |
| Cloud Storage | Files, exports, archives, evidence, model artifacts | Analytics, Audit, ML future |

## Cloud SQL Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Create PostgreSQL primary instance | Transactional database |
| [ ] | Create read replica | Read-scaling evidence |
| [ ] | Create service-owned schemas | Data ownership separation |
| [ ] | Configure migrations per service | Repeatable schema setup |
| [ ] | Configure write datasource | Writes go to primary |
| [ ] | Configure read datasource where useful | Read-heavy queries can use replica |
| [ ] | Configure connection pooling | Safe pod-to-db connection usage |
| [ ] | Enable backups and PITR | Recovery baseline |
| [ ] | Store credentials in secrets | No credentials in source |

## Cloud SQL Read Replica Use Cases

| Status | Use Case | Owner |
|---|---|---|
| [ ] | Project/profile catalogue reads | Project Service |
| [ ] | Parameter catalogue reads | Project Service |
| [ ] | Pond list/detail reads | Pond Service |
| [ ] | Alert history browsing | Notification Service |
| [ ] | Admin/reporting read screens | Analytics or admin APIs |

## Redis/Memorystore Checklist

| Status | Use Case | Owner |
|---|---|---|
| [ ] | API rate-limit counters | Gateway/API edge |
| [ ] | Profile type catalogue cache | Project Service |
| [ ] | Parameter catalogue cache | Project Service |
| [ ] | Project parameter setting cache | Project Service |
| [ ] | Growth indicator setting cache | Project Service |
| [ ] | Pond summary/status view cache | Pond Service |
| [ ] | Device-to-project/pond/port mapping cache | Sensor Service |
| [ ] | Authorization snapshot and token revocation state | Identity Service |
| [ ] | Threshold lookup cache | Notification Service |
| [ ] | WebSocket subscription registry | Realtime Gateway |
| [ ] | WebSocket cross-pod fanout | Realtime Gateway |

## Bigtable Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Define row-key strategy | `device/pond hash + reverse timestamp + seqNo` |
| [ ] | Define column families | `raw`, `sig`, `meta`, `reading` |
| [ ] | Define retention policy | TTL for telemetry |
| [ ] | Prepare emulator for local testing | Cost-safe development |
| [ ] | Prepare short-lived cloud evidence plan | Cost-controlled demo |
| [ ] | Document no replication in student demo | Cost boundary clear |

## BigQuery Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Create small bounded dataset | Demo analytics dataset |
| [ ] | Define partitioned tables | Partition by measured date/event date |
| [ ] | Define clustered columns | `project_id`, `pond_id`, `device_id`, `parameter` |
| [ ] | Set query cost controls | `maximum_bytes_billed`, budgets, dry runs |
| [ ] | Create summary tables/views | Chart-friendly analytics |
| [ ] | Document no replication in student demo | Cost boundary clear |

## Evidence Checklist

| Status | Evidence | Expected Result |
|---|---|---|
| [ ] | Cloud SQL primary screenshot | Primary exists |
| [ ] | Cloud SQL replica screenshot | Replica exists |
| [ ] | Write-to-primary demo | Write succeeds |
| [ ] | Read-replica demo | Read-heavy endpoint uses read path |
| [ ] | Redis cache demo | Cache hit/miss visible |
| [ ] | Pub/Sub-to-store demo | Telemetry reaches persistence |
| [ ] | BigQuery bounded query demo | Query scans controlled bytes |
