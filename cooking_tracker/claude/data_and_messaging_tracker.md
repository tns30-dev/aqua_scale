# Data And Messaging Tracker — Claude

Last updated: 2026-06-04
Legend: ⬜ not started · 🟨 in progress · ✅ done (evidence linked) · ⛔ blocked

## Summary for Codex

- **Current focus:** Local foundation DONE (compose stack verified). Next: first service skeleton (identity-access) or Terraform skeleton — user directs.
- **Last completed:** Clean implementation repo `aquashield/` created (git, monorepo layout). Docker Compose foundation up & verified: Postgres 16 with 9 service-owned schemas + per-service roles, Redis 7, Pub/Sub emulator with FULL decided catalogue (11 topics + 11 DLQs + all subscriptions with dead-letter policies, naming `<service>.<topic>.sub`), Bigtable emulator. (2026-06-04)
- **Blockers / questions:** None for local work. User confirmed GCP project + AWS account exist — will request credentials when provisioning starts.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Cloud SQL PostgreSQL primary | 🟨 | Local equivalent live: postgres16, schema-per-service (`local/postgres-init/01-schemas.sql`); cloud instance pending Terraform | `aquashield/docs/evidence/local-foundation/` | 2026-06-04 |
| Cloud SQL read replica | ⬜ | — | — | — |
| Redis/Memorystore (authz snapshot, cache, rate-limit, fanout) | 🟨 | Local Redis 7 up (compose); key catalogue per `main/redis.md` to be implemented with Identity service | `aquashield/docs/evidence/local-foundation/` | 2026-06-04 |
| Cloud Bigtable (telemetry; emulator-first, cost-safe) | 🟨 | Emulator running on :8086 (emulator-first per cost plan); row-key/table design lands with Ingestion | `aquashield/docs/evidence/local-foundation/` | 2026-06-04 |
| BigQuery (bounded demo dataset, cost controls) | ⬜ | — | — | — |
| Cloud Storage (reports/exports/artifacts) | ⬜ | — | — | — |
| Google Pub/Sub (topics, subscriptions, schemas, DLQs) | 🟨 | Full decided catalogue scripted + verified on emulator (`scripts/pubsub-bootstrap.sh`); event schema files (`contracts/events/*.v1.json`) + cloud topics pending | `aquashield/docs/evidence/local-foundation/2026-06-04-compose-foundation.txt` | 2026-06-04 |
| AWS IoT Core (things, certs, policies, rules) | ⬜ | — | — | — |
| AWS Lambda bridge (TS, WIF → Pub/Sub) | ⬜ | — | — | — |
| Terraform-managed infrastructure (GCS remote state) | ⬜ | — | — | — |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Tracker initialized. Specs read (`polyglot_persistence.md`, `redis.md`, `eda.md`, `pub_sub_contract_docs.md`, `iot.md`, `terraform.md`). |
| 2026-06-04 | Clean repo `aquashield/` scaffolded (services/, libs/proto-contracts/, contracts/events/, deploy/k8s/, infra/, tests/jmeter/). Compose foundation up & verified: postgres (9 schemas, healthy), redis (PONG), pubsub emulator (22 topics incl. DLQs, subs with deadLetterPolicy maxDeliveryAttempts=5, ackDeadline=30s), bigtable emulator. First commit `22a6d19`. |
