# Cloud Foundation Tracker - Codex

Last updated: 2026-06-04

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary for Claude

- Current focus: Root `k8s/` platform skeleton and Terraform GCP foundation scaffold are restored/validated.
- Last completed: Notification Service K8s workload manifests added and dev/staging overlays render successfully.
- Blockers / questions: Real cloud provisioning still needs GCP project ID, region, domain/certificate decision, and repo URL for Argo CD.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Custom VPC | IN_PROGRESS | Terraform module scaffold created and validated; cloud apply not started. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-04-terraform-validation.md` | 2026-06-04 |
| GKE subnet | IN_PROGRESS | Terraform module scaffold created and validated; cloud apply not started. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-04-terraform-validation.md` | 2026-06-04 |
| Pod secondary range | IN_PROGRESS | Terraform module scaffold created and validated; cloud apply not started. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-04-terraform-validation.md` | 2026-06-04 |
| Service secondary range | IN_PROGRESS | Terraform module scaffold created and validated; cloud apply not started. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-04-terraform-validation.md` | 2026-06-04 |
| Private nodes | IN_PROGRESS | Terraform GKE scaffold enables private nodes; cloud apply not started. | `../../infra/modules/gke/`, `../../docs/evidence/terraform-foundation/2026-06-04-terraform-validation.md` | 2026-06-04 |
| Cloud NAT | IN_PROGRESS | Terraform network scaffold includes Cloud NAT; cloud apply not started. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-04-terraform-validation.md` | 2026-06-04 |
| Private Google Access / PSC | IN_PROGRESS | Terraform network scaffold enables Private Google Access; PSC/private service access to be extended with data modules. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-04-terraform-validation.md` | 2026-06-04 |
| VPC firewall rules | IN_PROGRESS | Terraform network scaffold includes GCLB health-check and internal allow rules; tighter app/data rules pending service/data modules. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-04-terraform-validation.md` | 2026-06-04 |
| Kubernetes NetworkPolicy | IN_PROGRESS | Base default-deny ingress, app-internal allow, and GCLB health-check allow policies created; service-specific allow policies pending service deployments. | `../../k8s/base/network/` | 2026-06-04 |
| Istio service mesh | IN_PROGRESS | Namespace mesh labels, strict mTLS, and namespace default-deny AuthorizationPolicy created; service-specific allow policies pending. | `../../k8s/base/mesh/` | 2026-06-04 |
| Namespaces | IN_PROGRESS | Dev and staging namespace manifests created; not applied to a live cluster yet. | `../../k8s/overlays/dev/namespace.yaml`, `../../k8s/overlays/staging/namespace.yaml` | 2026-06-04 |
| Identity Access workload manifests | IN_PROGRESS | Deployment, Service, HPA, PDB, ConfigMap, NetworkPolicy, and AuthorizationPolicy created; cloud apply not started. | `../../k8s/base/services/identity-access-service/`, `../../docs/evidence/k8s-identity-access/2026-06-04-identity-kustomize-validation.md` | 2026-06-04 |
| Project Service workload manifests | IN_PROGRESS | Deployment, Service, HPA, PDB, ConfigMap, NetworkPolicy, AuthorizationPolicy, REST route, and gRPC port created; cloud apply not started. | `../../k8s/base/services/project-service/`, `../../docs/evidence/k8s-project-service/2026-06-04-project-kustomize-validation.md` | 2026-06-04 |
| Sensor Service workload manifests | IN_PROGRESS | Deployment, Service, HPA, PDB, ConfigMap, NetworkPolicy, AuthorizationPolicy, REST routes, and gRPC port created; cloud apply not started. | `../../k8s/base/services/sensor-service/`, `../../docs/evidence/k8s-sensor-service/2026-06-04-sensor-kustomize-validation.md` | 2026-06-04 |
| Ingestion Service workload manifests | IN_PROGRESS | Internal Pub/Sub worker Deployment, Service, HPA, PDB, ConfigMap, NetworkPolicy, and actuator-only AuthorizationPolicy created; no public HTTPRoute by design; cloud apply not started. | `../../k8s/base/services/ingestion-service/`, `../../docs/evidence/k8s-ingestion-service/2026-06-04-ingestion-kustomize-validation.md` | 2026-06-04 |
| Notification Service workload manifests | IN_PROGRESS | Deployment, Service, HPA, PDB, ConfigMap, NetworkPolicy, AuthorizationPolicy, alert REST route, Redis/project gRPC config, and Pub/Sub subscription config created; cloud apply not started. | `../../k8s/base/services/notification-service/`, `../../docs/evidence/k8s-notification-service/2026-06-04-notification-kustomize-validation.md` | 2026-06-04 |
| Artifact Registry | IN_PROGRESS | Terraform module scaffold creates service image repositories; cloud apply not started. | `../../infra/modules/artifact-registry/`, `../../docs/evidence/terraform-foundation/2026-06-04-terraform-validation.md` | 2026-06-04 |
| Terraform remote state | IN_PROGRESS | Bootstrap config and dev `gcs` backend example created; state bucket not applied yet. | `../../infra/bootstrap-state/`, `../../infra/environments/dev/backend.tf.example` | 2026-06-04 |

## Validation

| Check | Result | Updated |
|---|---|---|
| `kubectl kustomize k8s/overlays/dev` | PASS; evidence in `../../docs/evidence/k8s-foundation/2026-06-04-kustomize-validation.md` | 2026-06-04 |
| `kubectl kustomize k8s/overlays/staging` | PASS; evidence in `../../docs/evidence/k8s-foundation/2026-06-04-kustomize-validation.md` | 2026-06-04 |
| `kubectl kustomize k8s/overlays/dev` after Identity workload | PASS; evidence in `../../docs/evidence/k8s-identity-access/2026-06-04-identity-kustomize-validation.md` | 2026-06-04 |
| `kubectl kustomize k8s/overlays/staging` after Identity workload | PASS; evidence in `../../docs/evidence/k8s-identity-access/2026-06-04-identity-kustomize-validation.md` | 2026-06-04 |
| `kubectl kustomize k8s/overlays/dev` after Project workload | PASS; evidence in `../../docs/evidence/k8s-project-service/2026-06-04-project-kustomize-validation.md` | 2026-06-04 |
| `kubectl kustomize k8s/overlays/staging` after Project workload | PASS; evidence in `../../docs/evidence/k8s-project-service/2026-06-04-project-kustomize-validation.md` | 2026-06-04 |
| `kubectl kustomize k8s/overlays/dev` after Sensor workload | PASS; evidence in `../../docs/evidence/k8s-sensor-service/2026-06-04-sensor-kustomize-validation.md` | 2026-06-04 |
| `kubectl kustomize k8s/overlays/staging` after Sensor workload | PASS; evidence in `../../docs/evidence/k8s-sensor-service/2026-06-04-sensor-kustomize-validation.md` | 2026-06-04 |
| `kubectl kustomize k8s/overlays/dev` after Ingestion workload | PASS; evidence in `../../docs/evidence/k8s-ingestion-service/2026-06-04-ingestion-kustomize-validation.md` | 2026-06-04 |
| `kubectl kustomize k8s/overlays/staging` after Ingestion workload | PASS; evidence in `../../docs/evidence/k8s-ingestion-service/2026-06-04-ingestion-kustomize-validation.md` | 2026-06-04 |
| `kubectl kustomize k8s/overlays/dev` after Notification workload | PASS; evidence in `../../docs/evidence/k8s-notification-service/2026-06-04-notification-kustomize-validation.md` | 2026-06-04 |
| `kubectl kustomize k8s/overlays/staging` after Notification workload | PASS; evidence in `../../docs/evidence/k8s-notification-service/2026-06-04-notification-kustomize-validation.md` | 2026-06-04 |
| `terraform fmt -check -recursive infra` | PASS; evidence in `../../docs/evidence/terraform-foundation/2026-06-04-terraform-validation.md` | 2026-06-04 |
| `terraform -chdir=infra/bootstrap-state validate` | PASS; evidence in `../../docs/evidence/terraform-foundation/2026-06-04-terraform-validation.md` | 2026-06-04 |
| `terraform -chdir=infra/environments/dev validate` | PASS; evidence in `../../docs/evidence/terraform-foundation/2026-06-04-terraform-validation.md` | 2026-06-04 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Added Notification Service K8s workload manifests on port `8087`, with alert REST route `/api/alerts`, Redis/project gRPC config, Pub/Sub subscription config, HPA/PDB, NetworkPolicy, and Istio AuthorizationPolicy; dev/staging overlays validated. |
| 2026-06-04 | Added Ingestion Service K8s workload manifests as an internal Pub/Sub worker on port `8084`, with Sensor/Project gRPC targets, HPA/PDB, NetworkPolicy, and actuator-only Istio AuthorizationPolicy; dev/staging overlays validated. |
| 2026-06-04 | Added Sensor Service K8s workload manifests, REST/gRPC ports, NetworkPolicy, Istio AuthorizationPolicy, and updated HTTPRoute to service port `8083`; dev/staging overlays validated. |
| 2026-06-04 | Added Project Service K8s workload manifests, REST/gRPC ports, NetworkPolicy, Istio AuthorizationPolicy, and updated HTTPRoute to service port `8082`; dev/staging overlays validated. |
| 2026-06-04 | Added Identity Access Service K8s workload manifests and updated API Gateway HTTPRoute to service port `8081`; dev/staging overlays validated. |
| 2026-06-04 | Added validated Terraform scaffold for GCS remote state bootstrap, dev network, private GKE, Artifact Registry repositories, and Cloud Armor policy foundation. No cloud resources applied. |
| 2026-06-04 | Repo flattened to root layout; platform manifests restored under root `k8s` and dev/staging overlays validated. |
| 2026-06-04 | Added Kustomize base, dev/staging overlays, service accounts, NetworkPolicy skeleton, Istio strict/default-deny skeleton, and Gateway/HTTPRoute skeleton. |
