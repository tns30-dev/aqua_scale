# Data And Messaging Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns managed data services, event infrastructure, AWS IoT ingress, the Lambda bridge, and Terraform-managed infrastructure.
- Current state: Local equivalents are heavily exercised through Docker Compose, Flyway, Redis, Pub/Sub emulator, and Bigtable emulator. GCP remote state, Artifact Registry, GitHub OIDC/WIF, VPC/NAT/firewall, GKE, Istio, Argo CD, all-service image backfill, and the full nine-service `dev-full` runtime are live. Managed GCP data/messaging Terraform and the `dev-managed` Kustomize overlay are now code-ready but not applied.
- Current test: Local service integration tests, Pub/Sub emulator flows, Redis key evidence, Terraform validation, remote-state apply, Artifact Registry apply, GKE runtime apply, all-service deploy handoff, full Argo dev rollout, and `kubectl kustomize k8s/overlays/dev-managed`.
- Next test: Refresh application-default credentials for `aquashieldnus@gmail.com`, enable managed data toggles locally, run Terraform plan/apply for Cloud SQL, Memorystore, Pub/Sub, Bigtable, and BigQuery, then cut Argo over to `k8s/overlays/dev-managed`.
- Inputs ready from user: GCP account, project, region, and AWS account exist. Still need AWS account/region confirmation and whether AWS IoT/Lambda should be Terraform-managed or manually evidenced.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Cloud SQL PostgreSQL primary | IN_PROGRESS | Terraform module added for private-IP PostgreSQL 16, generated service users, backups/PITR, outputs, and Kubernetes bootstrap/cutover overlay. Apply evidence pending ADC refresh and plan review. | `../../infra/modules/managed-data/`, `../../k8s/overlays/dev-managed/`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-slice-code-readiness.md` | 2026-06-05 |
| Cloud SQL read replica | TODO | No cloud primary yet, so replica evidence is pending. | `../main/polyglot_persistence.md` | 2026-06-05 |
| Redis/Memorystore | IN_PROGRESS | Terraform module added for private Memorystore Redis and the `dev-managed` overlay now replaces in-cluster Redis config with the managed endpoint placeholder. Apply evidence pending. | `../../infra/modules/managed-data/`, `../../k8s/overlays/dev-managed/`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-slice-code-readiness.md` | 2026-06-05 |
| Cloud Bigtable | IN_PROGRESS | Terraform module added for a one-node production telemetry instance/table. Application repository seam still uses Postgres demo store until the Bigtable repository implementation is wired. | `../../infra/modules/managed-data/`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-slice-code-readiness.md`, `../../docs/evidence/ingestion-service/` | 2026-06-05 |
| BigQuery | IN_PROGRESS | Terraform module added for a bounded `aquashield_dev_analytics` dataset plus partitioned `readings` and `alerts` tables. Analytics code read path remains a future wiring slice. | `../../infra/modules/managed-data/`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-slice-code-readiness.md` | 2026-06-05 |
| Cloud Storage | TODO | Reports/exports/artifacts/cold archive bucket plan pending. | `../main/polyglot_persistence.md` | 2026-06-05 |
| Google Pub/Sub | IN_PROGRESS | Terraform module now declares the real topic/subscription/DLQ catalogue matching the emulator contract. The `dev-managed` overlay clears `PUBSUB_EMULATOR_HOST` so workloads use ADC/Workload Identity. Apply evidence pending. | `../../infra/modules/managed-data/`, `../../scripts/pubsub-bootstrap.sh`, `../../k8s/overlays/dev-managed/`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-slice-code-readiness.md` | 2026-06-05 |
| AWS IoT Core | TODO | Specs define MQTT ingress, device identity, certs, policies, and IoT rules. No AWS resources or Terraform module yet. | `../main/iot.md`, `../main/network_security.md` | 2026-06-05 |
| AWS Lambda bridge | TODO | TypeScript bridge must normalize IoT telemetry into `iot.telemetry.received` and publish to Google Pub/Sub through WIF with publisher-only IAM. No Lambda project yet. | `../main/iot.md`, `../main/pub_sub_contract_docs.md`, `../main/physical_arch_docs.md` | 2026-06-05 |
| Terraform-managed infrastructure | DONE | GCS remote-state bucket, dev backend, Artifact Registry repositories, GitHub OIDC/WIF, VPC, NAT, firewall, and GKE runtime foundation are managed in remote state. Managed data module code is added; apply is pending ADC refresh. Cloud Armor remains design-only; AWS IoT/Lambda modules are separate future slices. | `../../infra/bootstrap-state/`, `../../infra/environments/dev/backend.tf.example`, `../../infra/modules/managed-data/`, `../../docs/CLOUD_FOUNDATION_SLICE_1.md`, `../../docs/evidence/terraform-foundation/2026-06-05-cloud-foundation-slice-1-readiness.md`, `../../docs/evidence/terraform-foundation/2026-06-05-artifact-registry-apply.md`, `../../docs/evidence/terraform-foundation/2026-06-05-github-oidc-deploy-handoff.md`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-slice-code-readiness.md` | 2026-06-05 |

## Validation

| Check | Result | Updated |
|---|---|---|
| Local data/messaging integration | PASS in existing per-service IT evidence. | 2026-06-04 |
| Terraform foundation validation | PASS for current scaffold. | 2026-06-04 |
| Tracker ownership rewrite | PASS; all data/messaging rows are Codex-owned. | 2026-06-05 |
| Cloud Foundation Slice 1 readiness | PASS; remote-state bucket created and dev foundation plan saved. | 2026-06-05 |
| Artifact Registry Terraform apply | PASS; repository resources are in remote state and verified in GCP. | 2026-06-05 |
| GitHub OIDC/WIF Terraform apply | PASS; deployer identity and repository writer bindings are in remote state. | 2026-06-05 |
| GKE runtime foundation Terraform apply | PASS; network/GKE resources are in remote state and final plan is clean. | 2026-06-05 |
| Full dev runtime with in-cluster dependencies | PASS; Argo reports `Synced/Healthy` on `k8s/overlays/dev-full`, all nine service pods are ready, Postgres schemas exist, Redis returns `PONG`, and Pub/Sub bootstrap completed. | 2026-06-05 |
| Managed GCP overlay render | PASS; `kubectl kustomize k8s/overlays/dev-managed` renders with Cloud SQL/Memorystore placeholders, Workload Identity annotations, and emulator resources pruned. | 2026-06-05 |
| Terraform managed-data validation | PASS; backend-free temporary validation succeeds after adding the managed data module and `random` provider lock entries. Remote-state plan/apply is blocked by stale ADC for `acceclaim.user@gmail.com`; need `gcloud auth application-default login` as `aquashieldnus@gmail.com`. | 2026-06-05 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Local PostgreSQL, Redis, Pub/Sub emulator, and Bigtable emulator foundation validated. |
| 2026-06-04 | Redis catalogue and Pub/Sub flows became live across implemented services. |
| 2026-06-04 | Analytics read seams added over Ingestion and Project gRPC contracts. |
| 2026-06-05 | Rephrased tracker for Codex ownership of all data/messaging and cloud infrastructure rows. |
| 2026-06-05 | Cloud Foundation Slice 1 readiness added for remote state and dev foundation planning. Remote-state bucket created in `aerobic-guide-498413-u6`; dev foundation plan passed and is pending cost approval before apply. |
| 2026-06-05 | Artifact Registry resources applied through Terraform remote state. Data stores, Pub/Sub cloud topics, and AWS IoT/Lambda remain separate future slices. |
| 2026-06-05 | GitHub OIDC/WIF and all-service image backfill completed; runtime foundation is now the blocker before managed data and Pub/Sub cloud slices. |
| 2026-06-05 | Runtime foundation applied through Terraform. Managed data, Pub/Sub cloud topics, and AWS IoT/Lambda remain separate future slices after app rollout proof. |
| 2026-06-05 | Proved the data-free GitOps smoke path with analytics-service. Full runtime health is now gated by the managed data/messaging slice or explicit billing/quota expansion. |
| 2026-06-05 | Added the full `dev-full` runtime and proved Argo `Synced/Healthy` with all nine service pods ready on in-cluster Postgres/Redis/Pub/Sub emulator dependencies. |
| 2026-06-05 | Added Terraform-managed Cloud SQL, Memorystore, Pub/Sub, Bigtable, BigQuery code plus `k8s/overlays/dev-managed`; apply/cutover is pending ADC refresh and plan review. |
