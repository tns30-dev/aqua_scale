# Data And Messaging Tracker — Claude

Last updated: 2026-06-04
Legend: ⬜ not started · 🟨 in progress · ✅ done (evidence linked) · ⛔ blocked

## Summary for Codex

- **Current focus:** The data layer is in heavy production use by FIVE services locally. Next data-side work: event schema files (`shared-api/events/*.v1.json`), Bigtable raw-store impl behind the ReadingStore seam, then Terraform for the cloud instances.
- **Last completed (2026-06-04):** Redis key catalogue from `main/redis.md` is now LIVE and IT-tested across services: `auth:refresh{,-family}` + `auth:revoked:{jti}` + `ratelimit:login` (identity), `authz:snapshot/{version}` (identity→all consumers), `project:parameters:{id}` + `project:catalogue:*` (project), `sensor:device-map:{code}` (sensor), `notification:threshold:{projectId}` (notification, event-invalidated). Pub/Sub catalogue extended (+project.*, device.*, project.sensor.*) and exercised by 4 publisher/consumer services against the emulator. 5 service schemas under Flyway (identity_access, project, sensor, ingestion, notification).
- **Blockers / questions:** None for local work. GCP project + AWS account confirmed to exist — will request credentials when Terraform/provisioning starts.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Cloud SQL PostgreSQL primary | 🟨 | Local equivalent in production use: 5 service schemas with Flyway migrations + service DB roles; schema-per-service ownership enforced (no cross-schema access in code). Cloud instance pending Terraform | `docs/evidence/local-foundation/` + per-service ITs | 2026-06-04 |
| Cloud SQL read replica | ⬜ | — | — | — |
| Redis/Memorystore (authz snapshot, cache, rate-limit, fanout) | 🟨 | Key catalogue IMPLEMENTED + IT-tested: refresh rotation/family, jti revocation, login rate-limit, authz snapshots (producer + fail-closed consumers), project settings/catalogue caches, sensor device-map (invalidated on mapping/credential writes), notification threshold cache (event-invalidated). WS keys NOW LIVE too: ws:token (one-time), ws:jti (replay), ws:sub TTL+heartbeat, ws:fanout:{projectId} pub/sub channel (realtime-gateway ITs). Memorystore cloud instance pending Terraform | live key listings in `docs/evidence/identity-access/`; per-service ITs | 2026-06-04 |
| Cloud Bigtable (telemetry; emulator-first, cost-safe) | 🟨 | Emulator in compose; Ingestion persists to the spec-sanctioned Postgres demo store behind the `ReadingStore` seam — Bigtable impl (row key device/pond hash + reverse ts + seq; families raw/sig/meta/reading) is the swap-in next step | `docs/evidence/ingestion-service/` | 2026-06-04 |
| BigQuery (bounded demo dataset, cost controls) | ⬜ | — | — | — |
| Cloud Storage (reports/exports/artifacts) | ⬜ | — | — | — |
| Google Pub/Sub (topics, subscriptions, schemas, DLQs) | 🟨 | Catalogue scripted (idempotent bootstrap, +project.*/device.*/project.sensor.* extensions) AND exercised in anger: project/sensor publish, ingestion consumes iot.telemetry.received with ack/nack DLQ discipline, notification consumes reading.ingested + settings invalidation — all IT-tested vs emulator with the canonical EventEnvelope. PENDING: schema files `shared-api/events/*.v1.json`, cloud topics | per-service ITs + `docs/evidence/` | 2026-06-04 |
| AWS IoT Core (things, certs, policies, rules) | ⬜ | — | — | — |
| AWS Lambda bridge (TS, WIF → Pub/Sub) | ⬜ | — | — | — |
| Terraform-managed infrastructure (GCS remote state) | ⬜ | — | — | — |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Tracker initialized. Specs read (`polyglot_persistence.md`, `redis.md`, `eda.md`, `pub_sub_contract_docs.md`, `iot.md`, `terraform.md`). |
| 2026-06-04 | Clean repo `aquashield/` scaffolded (services/, libs/proto-contracts/, contracts/events/, deploy/k8s/, infra/, tests/jmeter/). Compose foundation up & verified: postgres (9 schemas, healthy), redis (PONG), pubsub emulator (22 topics incl. DLQs, subs with deadLetterPolicy maxDeliveryAttempts=5, ackDeadline=30s), bigtable emulator. First commit `22a6d19`. |
| 2026-06-04 | CORRECTION/refresh: evidence paths fixed (`aquashield/` layer was dissolved — everything lives at repo root `docs/evidence/`). Redis catalogue + Pub/Sub flows now live across 5 services (items updated). |
| 2026-06-04 | Redis WS key set live (token/jti/sub/fanout) via realtime-gateway; full redis.md catalogue except dispatcher keys now exercised. |
