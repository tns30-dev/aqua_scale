# Cloud Foundation Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns GCP foundation, GKE, service mesh, Kubernetes manifests, Artifact Registry, and Terraform remote state.
- Current state: Terraform and Kustomize scaffolds are validated locally. No real GCP resources have been applied yet.
- Current test: `terraform fmt/validate` and `kubectl kustomize` for dev/staging overlays.
- Next test: Run a cost-reviewed Terraform plan against the user's GCP project, then apply the remote-state bucket and dev foundation in controlled steps.
- Inputs ready from user: GCP account exists. Still need exact project ID, preferred region/zone, billing/cost constraints, domain/certificate choice, and GitHub repo URL for Argo CD.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Custom VPC | IN_PROGRESS | Terraform module scaffold created and validated; cloud apply not started. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-04-terraform-validation.md` | 2026-06-04 |
| GKE subnet | IN_PROGRESS | Terraform module scaffold created and validated; cloud apply not started. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-04-terraform-validation.md` | 2026-06-04 |
| Pod secondary range | IN_PROGRESS | VPC-native pod secondary range is in Terraform scaffold; cloud apply not started. | `../../infra/modules/network/` | 2026-06-04 |
| Service secondary range | IN_PROGRESS | VPC-native service secondary range is in Terraform scaffold; cloud apply not started. | `../../infra/modules/network/` | 2026-06-04 |
| Private nodes | IN_PROGRESS | GKE module enables private nodes; cloud apply not started. | `../../infra/modules/gke/` | 2026-06-04 |
| Cloud NAT | IN_PROGRESS | Network module includes Cloud NAT; cloud apply not started. | `../../infra/modules/network/` | 2026-06-04 |
| Private Google Access / PSC | IN_PROGRESS | Private Google Access is enabled in the network scaffold; PSC/private service access needs data modules. | `../../infra/modules/network/` | 2026-06-04 |
| VPC firewall rules | IN_PROGRESS | Health-check and internal allow rules exist; app/data-specific rules remain pending. | `../../infra/modules/network/` | 2026-06-04 |
| Kubernetes NetworkPolicy | IN_PROGRESS | Base default-deny ingress, app-internal allow, GCLB health-check allow, and per-service policies exist. | `../../k8s/base/network/`, `../../k8s/base/services/` | 2026-06-04 |
| Istio service mesh | IN_PROGRESS | Namespace mesh labels, strict mTLS, and AuthorizationPolicy skeletons exist; live mesh evidence pending. | `../../k8s/base/mesh/`, `../../k8s/base/services/` | 2026-06-04 |
| Namespaces | IN_PROGRESS | Dev and staging namespace manifests exist; not applied to a live cluster yet. | `../../k8s/overlays/dev/namespace.yaml`, `../../k8s/overlays/staging/namespace.yaml` | 2026-06-04 |
| Service workload manifests | IN_PROGRESS | All nine implemented services have Deployment, Service, HPA, PDB, ConfigMap, NetworkPolicy, and AuthorizationPolicy manifests. | `../../k8s/base/services/`, `../../docs/evidence/k8s-*/` | 2026-06-04 |
| Artifact Registry | IN_PROGRESS | Terraform module creates per-service Docker repositories; cloud apply not started. | `../../infra/modules/artifact-registry/` | 2026-06-04 |
| Terraform remote state | IN_PROGRESS | Bootstrap config and dev `gcs` backend example exist; state bucket not applied yet. | `../../infra/bootstrap-state/`, `../../infra/environments/dev/backend.tf.example` | 2026-06-04 |

## Validation

| Check | Result | Updated |
|---|---|---|
| `kubectl kustomize k8s/overlays/dev` | PASS; evidence recorded. | 2026-06-04 |
| `kubectl kustomize k8s/overlays/staging` | PASS; evidence recorded. | 2026-06-04 |
| `terraform fmt -check -recursive infra` | PASS; evidence recorded. | 2026-06-04 |
| `terraform -chdir=infra/bootstrap-state validate` | PASS; evidence recorded. | 2026-06-04 |
| `terraform -chdir=infra/environments/dev validate` | PASS; evidence recorded. | 2026-06-04 |
| Tracker ownership rewrite | PASS; cloud foundation is Codex-owned. | 2026-06-05 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Added Kustomize base, dev/staging overlays, service accounts, NetworkPolicy skeleton, Istio strict/default-deny skeleton, and Gateway/HTTPRoute skeleton. |
| 2026-06-04 | Added validated Terraform scaffold for GCS remote state bootstrap, dev network, private GKE, Artifact Registry repositories, and Cloud Armor policy foundation. No cloud resources applied. |
| 2026-06-04 | Added and validated workload manifests for all implemented services. |
| 2026-06-05 | Rephrased tracker for Codex-only non-service ownership and noted that cloud accounts are ready but project details are still needed before apply. |
