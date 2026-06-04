# Data And Messaging Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns managed data services, event infrastructure, AWS IoT ingress, the Lambda bridge, and Terraform-managed infrastructure.
- Current state: Local equivalents are heavily exercised through Docker Compose, Flyway, Redis, Pub/Sub emulator, and Bigtable emulator. Cloud resources are not provisioned yet.
- Current test: Local service integration tests, Pub/Sub emulator flows, Redis key evidence, and Terraform validation.
- Next test: Add cost-bounded Terraform modules for Cloud SQL, Memorystore, Pub/Sub, Bigtable, GCS, AWS IoT, and Lambda; run plan against the user's GCP/AWS accounts before applying.
- Inputs ready from user: GCP and AWS accounts exist. Still need project/account IDs, regions, cost ceilings, and whether AWS IoT/Lambda should be Terraform-managed or manually evidenced.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Cloud SQL PostgreSQL primary | IN_PROGRESS | Local equivalent is in production use: service-owned schemas, Flyway migrations, roles, and append-only audit table. Cloud SQL module pending. | `../../docs/evidence/local-foundation/`, per-service ITs | 2026-06-04 |
| Cloud SQL read replica | TODO | No cloud primary yet, so replica evidence is pending. | `../main/polyglot_persistence.md` | 2026-06-05 |
| Redis/Memorystore | IN_PROGRESS | Redis key catalogue is implemented and IT-tested locally across authz, cache, rate-limit, realtime, notification, and analytics metadata cache. Memorystore module pending. | `../../docs/evidence/identity-access/`, per-service ITs | 2026-06-04 |
| Cloud Bigtable | IN_PROGRESS | Emulator exists. Ingestion uses a Postgres demo store behind `ReadingStore`; Bigtable implementation and cloud instance are pending. | `../../docs/evidence/ingestion-service/` | 2026-06-04 |
| BigQuery | TODO | Target analytics warehouse remains pending; needs bounded dataset and cost controls. | `../main/polyglot_persistence.md`, `../main/analytics_service.md` | 2026-06-05 |
| Cloud Storage | TODO | Reports/exports/artifacts/cold archive bucket plan pending. | `../main/polyglot_persistence.md` | 2026-06-05 |
| Google Pub/Sub | IN_PROGRESS | Local catalogue is scripted and exercised by publishers/consumers. Cloud topics, subscriptions, schemas, and DLQs are pending Terraform/apply evidence. | per-service ITs, `../../docs/evidence/` | 2026-06-04 |
| AWS IoT Core | TODO | Specs define MQTT ingress, device identity, certs, policies, and IoT rules. No AWS resources or Terraform module yet. | `../main/iot.md`, `../main/network_security.md` | 2026-06-05 |
| AWS Lambda bridge | TODO | TypeScript bridge must normalize IoT telemetry into `iot.telemetry.received` and publish to Google Pub/Sub through WIF with publisher-only IAM. No Lambda project yet. | `../main/iot.md`, `../main/pub_sub_contract_docs.md`, `../main/physical_arch_docs.md` | 2026-06-05 |
| Terraform-managed infrastructure | IN_PROGRESS | GCS remote-state bootstrap and first GCP foundation modules exist. Data modules and AWS IoT/Lambda modules are pending. | `../../infra/bootstrap-state/`, `../../infra/environments/dev/backend.tf.example`, `../../docs/evidence/terraform-foundation/2026-06-04-terraform-validation.md` | 2026-06-05 |

## Validation

| Check | Result | Updated |
|---|---|---|
| Local data/messaging integration | PASS in existing per-service IT evidence. | 2026-06-04 |
| Terraform foundation validation | PASS for current scaffold. | 2026-06-04 |
| Tracker ownership rewrite | PASS; all data/messaging rows are Codex-owned. | 2026-06-05 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Local PostgreSQL, Redis, Pub/Sub emulator, and Bigtable emulator foundation validated. |
| 2026-06-04 | Redis catalogue and Pub/Sub flows became live across implemented services. |
| 2026-06-04 | Analytics read seams added over Ingestion and Project gRPC contracts. |
| 2026-06-05 | Rephrased tracker for Codex ownership of all data/messaging and cloud infrastructure rows. |
