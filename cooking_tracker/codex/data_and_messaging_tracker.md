# Data And Messaging Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns managed data services, event infrastructure, AWS IoT ingress, the Lambda bridge, and Terraform-managed infrastructure.
- Current state: Local equivalents are heavily exercised through Docker Compose, Flyway, Redis, Pub/Sub emulator, and Bigtable emulator. GCP remote state, Artifact Registry, GitHub OIDC/WIF, VPC/NAT/firewall, GKE, Istio, Argo CD, all-service image backfill, managed Cloud SQL, Memorystore, Pub/Sub, Bigtable, BigQuery, the live `dev-managed` nine-service runtime, and the live AWS IoT/Lambda bridge are proven by business-flow smokes.
- Current test: Local service integration tests, Pub/Sub emulator flows, Redis key evidence, Terraform validation/apply, managed resource verification, Cloud SQL bootstrap logs, Argo CD managed-runtime sync, all-service readiness checks, signed telemetry through real Pub/Sub, AWS bridge unit tests/build, event schema validation, Terraform-managed AWS apply, x.509 MQTT publish, Lambda logs, WIF IAM proof, and AWS-to-GCP business-flow smoke.
- Next test: Move to public API edge/Firebase, then DAST/performance evidence.
- Inputs ready from user: GCP account/project/region and AWS profile `aquashield` are ready. Public edge still needs explicit HTTP exposure approval or domain/TLS input.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Cloud SQL PostgreSQL primary | DONE | Private PostgreSQL 16 instance `aquashield-dev-postgres` is live on `10.128.1.3`; service users and schemas were bootstrapped and all DB-backed services are healthy on the managed endpoint. | `../../infra/modules/managed-data/`, `../../k8s/overlays/dev-managed/`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-apply.md`, `../../docs/evidence/gitops/2026-06-05-argocd-dev-managed-rollout.md` | 2026-06-05 |
| Cloud SQL read replica | TODO | No cloud primary yet, so replica evidence is pending. | `../main/polyglot_persistence.md` | 2026-06-05 |
| Redis/Memorystore | DONE | Private Memorystore Redis `aquashield-dev-redis` is `READY` at `10.128.0.3:6379`; managed ConfigMaps point Redis users at it. | `../../infra/modules/managed-data/`, `../../k8s/overlays/dev-managed/`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-apply.md`, `../../docs/evidence/gitops/2026-06-05-argocd-dev-managed-rollout.md` | 2026-06-05 |
| Cloud Bigtable | DONE | Bigtable instance `aquashield-dev-telemetry` and table `telemetry_readings` are live. Application repository seam still uses Postgres demo store until native Bigtable write/read wiring is implemented. | `../../infra/modules/managed-data/`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-apply.md`, `../../docs/evidence/ingestion-service/` | 2026-06-05 |
| BigQuery | DONE | BigQuery dataset `aquashield_dev_analytics` and partitioned `readings`/`alerts` tables are live. Analytics code read path remains a future wiring slice. | `../../infra/modules/managed-data/`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-apply.md` | 2026-06-05 |
| Cloud Storage | TODO | Reports/exports/artifacts/cold archive bucket plan pending. | `../main/polyglot_persistence.md` | 2026-06-05 |
| Google Pub/Sub | DONE | Real topic/subscription/DLQ catalogue is live with 36 topics and 45 subscriptions. Java services now remove baked Spring emulator config, managed pods use Workload Identity credentials, and the smoke published signed telemetry into `iot.telemetry.received`. | `../../infra/modules/managed-data/`, `../../scripts/pubsub-bootstrap.sh`, `../../k8s/overlays/dev-managed/`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-apply.md`, `../../docs/evidence/gitops/2026-06-05-managed-business-flow-smoke.md` | 2026-06-05 |
| AWS IoT Core | DONE | Terraform created IoT thing `aq-dev-simulator-01`, generated x.509 certificate, publish-only policy, thing-principal attachment, and rule `aquashield_dev_iot_bridge` for `aquashield/dev/telemetry/+`. The smoke published signed telemetry over MQTT/TLS with the generated certificate. | `../../infra/modules/aws-iot-bridge/`, `../../docs/evidence/aws-iot-bridge/2026-06-05-code-readiness.md`, `../../docs/evidence/aws-iot-bridge/2026-06-05-live-deploy-and-smoke.md`, `../main/iot.md`, `../main/network_security.md` | 2026-06-05 |
| AWS Lambda bridge | DONE | TypeScript Lambda bridge normalizes AWS IoT Rule events into the live `iot.telemetry.received` envelope, preserves signed payloads, and publishes through GCP WIF with publisher-only IAM. CloudWatch logs show two Pub/Sub message IDs for the AWS smoke. | `../../aws-iot-bridge/`, `../../infra/modules/aws-iot-bridge/`, `../../docs/evidence/aws-iot-bridge/2026-06-05-code-readiness.md`, `../../docs/evidence/aws-iot-bridge/2026-06-05-live-deploy-and-smoke.md`, `../main/iot.md`, `../main/pub_sub_contract_docs.md`, `../main/physical_arch_docs.md` | 2026-06-05 |
| Terraform-managed infrastructure | DONE | GCS remote state, dev backend, Artifact Registry, GitHub OIDC/WIF, VPC, NAT, firewall, GKE, private service access, Cloud SQL, Memorystore, Pub/Sub, Bigtable, BigQuery, runtime service accounts, Workload Identity IAM, and AWS IoT/Lambda bridge resources are managed in remote state. | `../../infra/bootstrap-state/`, `../../infra/environments/dev/backend.tf.example`, `../../infra/modules/managed-data/`, `../../infra/modules/aws-iot-bridge/`, `../../docs/CLOUD_FOUNDATION_SLICE_1.md`, `../../docs/evidence/terraform-foundation/2026-06-05-cloud-foundation-slice-1-readiness.md`, `../../docs/evidence/terraform-foundation/2026-06-05-artifact-registry-apply.md`, `../../docs/evidence/terraform-foundation/2026-06-05-github-oidc-deploy-handoff.md`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-apply.md`, `../../docs/evidence/aws-iot-bridge/2026-06-05-code-readiness.md`, `../../docs/evidence/aws-iot-bridge/2026-06-05-live-deploy-and-smoke.md` | 2026-06-05 |

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
| Terraform managed-data validation | PASS; backend-free temporary validation succeeds after adding the managed data module and `random` provider lock entries. | 2026-06-05 |
| Terraform managed-data apply | PASS; Cloud SQL, Memorystore, Pub/Sub, Bigtable, BigQuery, runtime service accounts, IAM, and private service access are live. | 2026-06-05 |
| Managed runtime Argo rollout | PASS; `aquashield-dev` targets `k8s/overlays/dev-managed`, reports `Synced/Healthy`, and all nine service pods are `2/2 Running`. | 2026-06-05 |
| Managed telemetry business flow | PASS; signed telemetry published to real Pub/Sub produced persisted energy read-model data, an active threshold alert, pond comparison metrics, realtime token minting, and audit rows. | 2026-06-05 |
| AWS bridge code readiness | PASS; `npm test`, `npm run build`, `npm audit --omit=dev`, JSON schema validation, `terraform fmt`, backend-free `terraform init`, and `terraform validate` all passed. | 2026-06-05 |
| AWS account verification | PASS; AWS profile `aquashield` resolved to account `342327769401` in `ap-southeast-1`. | 2026-06-05 |
| AWS IoT/Lambda Terraform apply | PASS; Terraform created 16 bridge resources with 0 changes and 0 destroys. | 2026-06-05 |
| AWS IoT to managed business flow | PASS; x.509 MQTT publish through AWS IoT/Lambda produced `energyTotalKwh=3.1`, `activeAlerts=1`, `comparisonMetricCount=4`, `realtimeTokenMinted=true`, and `auditSecurityRows=4`. | 2026-06-05 |

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
| 2026-06-05 | Added Terraform-managed Cloud SQL, Memorystore, Pub/Sub, Bigtable, BigQuery code plus `k8s/overlays/dev-managed`; this became the live managed cutover later the same day. |
| 2026-06-05 | Applied managed Cloud SQL, Memorystore, Pub/Sub, Bigtable, BigQuery, runtime service accounts, IAM, and private service access through Terraform remote state. |
| 2026-06-05 | Cut Argo CD over to `k8s/overlays/dev-managed`; all nine service pods are healthy on managed Cloud SQL, Memorystore, and real Pub/Sub. |
| 2026-06-05 | Passed the managed-backed business smoke with signed telemetry through real Pub/Sub into ingestion, notification, analytics/realtime/audit read surfaces. |
| 2026-06-05 | Added AWS IoT/Lambda bridge TypeScript code, Terraform module, GCP WIF/Pub/Sub publisher IAM wiring, and code-readiness evidence. |
| 2026-06-05 | Applied the live AWS IoT/Lambda bridge and passed the x.509 MQTT-to-GCP Pub/Sub managed business smoke. |
