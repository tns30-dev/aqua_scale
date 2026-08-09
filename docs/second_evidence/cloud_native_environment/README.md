# Cloud-Native Environment Evidence

This folder is for second-round evidence that the cloud-native runtime is ready
for performance testing.

## First-Submission Evidence To Reuse

| Area | Existing evidence |
|---|---|
| GKE runtime foundation | `docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` |
| Managed data services | `docs/evidence/terraform-foundation/2026-06-05-managed-data-apply.md` |
| Argo CD managed rollout | `docs/evidence/gitops/2026-06-05-argocd-dev-managed-rollout.md` |
| Public API edge | `docs/evidence/public-edge/2026-06-05-public-edge-live-rollout.md` |
| Firebase hosting | `docs/evidence/public-edge/2026-06-05-firebase-hosting-live-deploy.md` |
| Managed business smoke | `docs/evidence/gitops/2026-06-05-managed-business-flow-smoke.md` |

## Second-Round Checks To Capture

| Check | Expected evidence |
|---|---|
| Terraform dev plan/apply | Done in `2026-08-08-new-project-bootstrap.md` |
| GKE cluster status | Done in `2026-08-08-new-project-bootstrap.md` |
| AWS IoT bridge | Done in `2026-08-08-new-project-bootstrap.md` |
| Service readiness | Done in `2026-08-08-gke-workload-rollout.md` |
| Managed data reachability | Done through Cloud SQL bootstrap and service rollout smoke |
| Istio/service mesh | Done in `2026-08-08-istio-mesh-rollout.md` |
| Prometheus/Grafana monitoring | Done in `2026-08-09-prometheus-grafana-monitoring.md` |
| Telemetry store correction | Done in `2026-08-09-telemetry-store-correction.md`; Cloud SQL telemetry tables cleared to 0 rows; 4M telemetry evidence loaded to Bigtable/BigQuery |
| Public API edge | Gateway programmed; `https://api.aquashield.live/api/csrf` returns `200` |
| k6 target readiness | Done; cloud k6 results are in `../performance/cloud_native_results.md` |

## Runtime Target Decision

Use a new GCP project for the second-round microservice environment. Do not use
`aquashield-staging`; that project belongs to the monolith application.

| Environment | Purpose |
|---|---|
| `k8s/overlays/performance` | Local/full in-cluster Kubernetes rehearsal |
| `k8s/overlays/performance-managed-public` | Final cloud-native evidence against managed GCP services and public API edge |

## Telemetry Store Rule

Cloud SQL is the transactional store for business/service data. The 4M telemetry
evidence belongs in Cloud Bigtable and BigQuery, not in the Cloud SQL ingestion
demo tables.

| Data | Store |
|---|---|
| Raw and operational time-series telemetry | Cloud Bigtable `aquashield-dev-telemetry/telemetry_readings` |
| Historical analytics facts | BigQuery `aquashield_dev_analytics.readings` with `4,000,000` rows |
| Business presentation data | Cloud SQL service schemas |
