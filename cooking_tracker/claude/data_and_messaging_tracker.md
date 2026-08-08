# Data And Messaging Tracker - Claude Historical

Last updated: 2026-06-05
Legend: ⬜ not started · 🟨 in progress · ✅ done (evidence linked) · ⛔ blocked

## Summary for Codex

- **Ownership status:** Historical only. Active ownership for all Data And Messaging rows moved to [Codex data/messaging tracker](../codex/data_and_messaging_tracker.md) on 2026-06-05.
- **Current focus:** The data layer is in heavy production use locally. Next data-side work: event schema files (`shared-api/events/*.v1.json`) and Bigtable raw-store impl behind the ReadingStore seam. AWS IoT, Lambda bridge, and Terraform-managed infrastructure were transferred to Codex on 2026-06-05.
- **Last completed (2026-06-04):** READ seams over the data layer for analytics: `IngestionReadService.GetReadings` (gRPC :9095 — time-range reads from the demo Postgres store; Bigtable swaps behind the same `ReadingStore` seam) and `ProjectService.GetChartConfig` (project schema now owns `visualisation_types` + `project_visualisations` via V3 migration — DDL parity with the monolith dump, 8 chart-type catalogue rows seeded with the engine's exact name strings). New Redis key: `analytics:chart-config:{projectId}` (metadata only, 60s TTL; raw readings are NEVER cached — IT-asserted). NOTE for Codex: main/redis.md has no analytics key section yet. Previous: full redis.md catalogue live across services; Pub/Sub catalogue exercised by 4 publisher/consumer services; 6 service schemas under Flyway (identity_access, project, sensor, ingestion, notification + pond).
- **Blockers / questions:** None for local work. Cloud credentials for the transferred AWS/GCP infrastructure rows are now Codex follow-up.

## Transferred To Codex

| Item | New tracker | Notes | Updated |
|---|---|---|---|
| Cloud SQL PostgreSQL primary | [Codex data/messaging tracker](../codex/data_and_messaging_tracker.md) | Local equivalent is proven; cloud module/apply evidence pending. | 2026-06-05 |
| Cloud SQL read replica | [Codex data/messaging tracker](../codex/data_and_messaging_tracker.md) | Pending Cloud SQL primary. | 2026-06-05 |
| Redis/Memorystore | [Codex data/messaging tracker](../codex/data_and_messaging_tracker.md) | Local Redis catalogue proven; Memorystore pending. | 2026-06-05 |
| Cloud Bigtable | [Codex data/messaging tracker](../codex/data_and_messaging_tracker.md) | Emulator and seam exist; cloud implementation pending. | 2026-06-05 |
| BigQuery | [Codex data/messaging tracker](../codex/data_and_messaging_tracker.md) | Bounded analytics warehouse pending. | 2026-06-05 |
| Cloud Storage | [Codex data/messaging tracker](../codex/data_and_messaging_tracker.md) | Reports/archive buckets pending. | 2026-06-05 |
| Google Pub/Sub | [Codex data/messaging tracker](../codex/data_and_messaging_tracker.md) | Local emulator catalogue proven; cloud topics/subscriptions pending. | 2026-06-05 |
| AWS IoT Core (things, certs, policies, rules) | [Codex data/messaging tracker](../codex/data_and_messaging_tracker.md) | Needs AWS account/region details, device identity mapping, and cost-safe provisioning plan. | 2026-06-05 |
| AWS Lambda bridge (TS, WIF → Pub/Sub) | [Codex data/messaging tracker](../codex/data_and_messaging_tracker.md) | Needs TypeScript Lambda bridge, AWS IoT rule trigger, and GCP WIF/Pub/Sub publisher IAM. | 2026-06-05 |
| Terraform-managed infrastructure (GCS remote state) | [Codex data/messaging tracker](../codex/data_and_messaging_tracker.md) | GCS remote-state scaffold exists; broader data/AWS modules remain pending. | 2026-06-05 |

## Historical Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Cloud SQL PostgreSQL primary | 🟨 | Local equivalent in production use: 7 service schemas with Flyway migrations + service DB roles; schema-per-service ownership enforced (no cross-schema access in code — analytics reads ONLY through gRPC seams, owns no schema). Chart config tables live in `project` schema (V3). NEW: `audit` schema with a DB-trigger-enforced append-only table (UPDATE/DELETE raise — first hard immutability guarantee in the platform). Cloud instance pending Terraform | `docs/evidence/local-foundation/` + per-service ITs | 2026-06-04 |
| Cloud SQL read replica | ⬜ | — | — | — |
| Redis/Memorystore (authz snapshot, cache, rate-limit, fanout) | 🟨 | Key catalogue IMPLEMENTED + IT-tested: refresh rotation/family, jti revocation, login rate-limit, authz snapshots (producer + fail-closed consumers — now incl. the TS consumer in analytics), project settings/catalogue caches, sensor device-map (invalidated on mapping/credential writes), notification threshold cache (event-invalidated), WS keys (token/jti/sub/fanout), `analytics:chart-config:{projectId}` (NEW — metadata only, 60s TTL, raw readings never cached). Memorystore cloud instance pending Terraform | live key listings in `docs/evidence/identity-access/`; per-service ITs | 2026-06-04 |
| Cloud Bigtable (telemetry; emulator-first, cost-safe) | 🟨 | Emulator in compose; Ingestion persists to the spec-sanctioned Postgres demo store behind the `ReadingStore` seam — Bigtable impl (row key device/pond hash + reverse ts + seq; families raw/sig/meta/reading) is the swap-in next step | `docs/evidence/ingestion-service/` | 2026-06-04 |
| BigQuery (bounded demo dataset, cost controls) | ⬜ | — | — | — |
| Cloud Storage (reports/exports/artifacts) | ⬜ | — | — | — |
| Google Pub/Sub (topics, subscriptions, schemas, DLQs) | 🟨 | Catalogue scripted (idempotent bootstrap) AND exercised in anger by publishers (identity NOW TOO — audit.event.recorded security payloads) and consumers (ingestion, notification, realtime, and audit-service consuming the dedicated audit topic + the 15-topic business stream — the catalogue's `audit.*` subs are all consumed now). Ack/nack DLQ discipline uniform. PENDING: schema files `shared-api/events/*.v1.json`, cloud topics | per-service ITs + `docs/evidence/` | 2026-06-04 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Tracker initialized. Specs read (`polyglot_persistence.md`, `redis.md`, `eda.md`, `pub_sub_contract_docs.md`, `iot.md`, `terraform.md`). |
| 2026-06-04 | Clean repo `aquashield/` scaffolded (services/, libs/proto-contracts/, contracts/events/, deploy/k8s/, infra/, tests/loadtests/). Compose foundation up & verified: postgres (9 schemas, healthy), redis (PONG), pubsub emulator (22 topics incl. DLQs, subs with deadLetterPolicy maxDeliveryAttempts=5, ackDeadline=30s), bigtable emulator. First commit `22a6d19`. |
| 2026-06-04 | CORRECTION/refresh: evidence paths fixed (`aquashield/` layer was dissolved — everything lives at repo root `docs/evidence/`). Redis catalogue + Pub/Sub flows now live across 5 services (items updated). |
| 2026-06-04 | Redis WS key set live (token/jti/sub/fanout) via realtime-gateway; full redis.md catalogue except dispatcher keys now exercised. |
| 2026-06-04 | Analytics data seams: Ingestion GetReadings (:9095, ReadingStore seam — Bigtable-ready) + Project GetChartConfig (chart config ownership moved INTO project schema, V3 migration, monolith-DDL parity). Analytics owns NO schema — pure gRPC consumer + metadata-only Redis cache (`analytics:chart-config:{projectId}`). BigQuery item unchanged (target for long-range analytics, not needed for the parity endpoint). |
| 2026-06-04 | audit schema live (append-only by DB trigger); audit-service consumes the dedicated audit topic + all 15 business-topic `audit.*` subs from the bootstrap catalogue; identity publishes its first events (security audit payloads). Spec'd audit cold archive (BigQuery/GCS) remains a future option. |
| 2026-06-04 | Readings seam extended for the [XSVC] consumers: GetReadings gains a project_id selector (energy is project-scoped) + pond_id row attribution; NEW GetReadingWindows (batched min/max per pond). Consumers: pond comparison (per-pond, 4-param filter), energy dashboard (project-wide, electricity filter), analytics charts. Windows are Asia/Singapore local-day bounds → UTC instants at the seam. JPA note: nested entities need explicit @Entity(name=...) for JPQL. |
| 2026-06-05 | Ownership handover expanded: all Data And Messaging rows moved to Codex data/messaging tracker. |
