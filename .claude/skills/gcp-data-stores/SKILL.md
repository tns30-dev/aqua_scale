---
name: gcp-data-stores
description: Use when working with AquaShield's data layer — Cloud SQL PostgreSQL (primary/replica, service-owned schemas), Redis/Memorystore (key design, authz snapshot, TTL rules), Cloud Bigtable (telemetry row keys, emulator), BigQuery (bounded analytics, cost caps), Cloud Storage. Trigger on "Cloud SQL", "schema", "Redis key", "authz snapshot", "Bigtable", "BigQuery", "cost control", "Memorystore".
---

# GCP data stores (specs: `main/polyglot_persistence.md`, `main/redis.md`)

## Store ownership map (decided)

| Store | Purpose | Owners |
|---|---|---|
| Cloud SQL (primary) | Transactional business data | Identity, Project, Pond, Sensor, Notification, Audit |
| Cloud SQL (replica) | Read-heavy non-critical reads | Project, Pond, Notification, Analytics |
| Bigtable | Telemetry time-series (target) | Ingestion (write), Analytics (read) |
| BigQuery | Historical analytics warehouse | Analytics, future ML |
| Redis/Memorystore | Authz snapshot, cache, rate limits, WS fanout — **never source of truth** | per `main/redis.md` ownership table |
| Cloud Storage | Files, exports, evidence, model artifacts | Analytics, Audit, future ML |

## Cloud SQL rules

- One **schema per service**; no cross-service table access — API/events only.
- Flyway per service; pooled connections (HikariCP sized for pod limits); private IP only.
- Writes → primary; replica only for the listed low-risk read paths. Backups + PITR on.

## Redis rules (the most spec'd component — follow `main/redis.md` exactly)

- **Key catalogue is decided** (`auth:session:{id}`, `auth:refresh:{hash}`,
  `authz:snapshot:{userId}:{version}`, `authz:version:{userId}`, `ratelimit:…`,
  `project:…`, `sensor:device-map:…`, `notification:threshold:…`, `ws:jti:{jti}`,
  `ws:sub:…`, `ws:fanout:{projectId}:{pondId}`). Don't invent keys — extend the doc first.
- **Every key has a TTL.** Refresh tokens stored as **hashes** with family tracking
  (rotation + reuse detection). Revoked `jti` kept until token expiry.
- **Authz snapshot:** built by Identity on login; versioned; invalidated on any
  role/access/status change; consumed (not owned) by other services; **fail closed** on
  security-critical Redis failure; non-critical caches may fall through to SQL.
- Cross-pod WS fanout via Redis pub/sub or Streams; socket objects stay pod-local.
- Cache invalidation pairs are spec'd per service (settings→threshold cache, mapping
  updates→device-map cache, …). Add hit/miss metrics — it's an evidence item.

## Bigtable rules (cost-guarded)

- Row key: `device/pond hash + reverse timestamp + seqNo`. Column families:
  `raw`, `sig`, `meta`, `reading`. TTL retention policy.
- **Emulator-first** for dev/tests; short-lived real instance only for demo evidence;
  no replication. Document the cost boundary explicitly.
- Query patterns must align to row-key ranges (pond/device + time range); no scans.

## BigQuery rules (cost-guarded)

- One small bounded demo dataset; tables **partitioned** by measured/event date and
  **clustered** on `project_id, pond_id, device_id, parameter`.
- `maximum_bytes_billed` on every query; dry-run in tests; date/project/pond filters
  mandatory; hourly/daily summary tables for chart-friendly reads.

## Evidence to capture as you go (→ `docs/evidence/`, then update tracker)

Primary/replica screenshots · write-vs-replica-read demo · cache hit/miss metrics ·
snapshot TTL + invalidation demo · refresh-rotation reuse rejection · Pub/Sub→store flow ·
bounded BigQuery query proof. Update `cooking_tracker/claude/data_and_messaging_tracker.md`.
