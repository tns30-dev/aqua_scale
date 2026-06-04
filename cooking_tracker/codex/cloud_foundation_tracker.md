# Cloud Foundation Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns GCP foundation, GKE, service mesh, Kubernetes manifests, Artifact Registry, and Terraform remote state.
- Current state: Terraform remote state bucket, nine Artifact Registry Docker repositories, GitHub OIDC/WIF deploy identity, and all nine service images are ready in billed project `aerobic-guide-498413-u6`; dev Terraform backend is initialized against GCS. The remaining dev foundation plan is saved locally and now contains only network, Cloud Armor, and GKE resources.
- Current test: `terraform fmt/validate`, `kubectl kustomize`, bootstrap-state apply, Artifact Registry targeted apply, GitHub OIDC/WIF targeted apply, all-service image backfill, and post-WIF dev foundation plan.
- Next test: Apply the reviewed network/GKE/Cloud Armor foundation plan, then verify VPC, subnet, NAT, firewall, Cloud Armor policy, GKE cluster, and workload image pull path.
- Inputs ready from user: GCP account, project, region, and zone are selected. Still need domain/certificate choice, GitHub repo URL for Argo CD, and final acceptance before creating the GKE runtime.

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
| Service workload manifests | IN_PROGRESS | All nine implemented services have Deployment, Service, HPA, PDB, ConfigMap, NetworkPolicy, and AuthorizationPolicy manifests; dev overlay now points all images to Artifact Registry tag `783c78a16381`. Live cluster apply is pending. | `../../k8s/base/services/`, `../../k8s/overlays/dev/kustomization.yaml`, `../../docs/evidence/k8s-*/` | 2026-06-05 |
| Artifact Registry | DONE | Nine per-service Docker repositories were created in `asia-southeast1` through Terraform state. CI image push remains tracked separately under CI/CD. | `../../infra/modules/artifact-registry/`, `../../docs/evidence/terraform-foundation/2026-06-05-artifact-registry-apply.md` | 2026-06-05 |
| Terraform remote state | DONE | State bucket created in project `aerobic-guide-498413-u6`; dev backend initialized against GCS. | `../../infra/bootstrap-state/`, `../../infra/environments/dev/backend.tf.example`, `../../docs/CLOUD_FOUNDATION_SLICE_1.md`, `../../docs/evidence/terraform-foundation/2026-06-05-cloud-foundation-slice-1-readiness.md` | 2026-06-05 |
| GitHub OIDC/WIF deploy identity | DONE | GitHub Actions provider, deployer service account, and per-repository Artifact Registry writer IAM bindings are managed in Terraform state. | `../../infra/modules/github-oidc/`, `../../docs/evidence/terraform-foundation/2026-06-05-github-oidc-deploy-handoff.md` | 2026-06-05 |

## Validation

| Check | Result | Updated |
|---|---|---|
| `kubectl kustomize k8s/overlays/dev` | PASS; evidence recorded. | 2026-06-04 |
| `kubectl kustomize k8s/overlays/staging` | PASS; evidence recorded. | 2026-06-04 |
| `terraform fmt -check -recursive infra` | PASS; evidence recorded. | 2026-06-04 |
| `terraform -chdir=infra/bootstrap-state validate` | PASS; evidence recorded. | 2026-06-04 |
| `terraform -chdir=infra/environments/dev validate` | PASS; evidence recorded. | 2026-06-04 |
| Tracker ownership rewrite | PASS; cloud foundation is Codex-owned. | 2026-06-05 |
| Cloud Foundation Slice 1 readiness | PASS; remote state created and dev foundation plan saved. Dev apply pending cost approval. | 2026-06-05 |
| Artifact Registry targeted apply | PASS; six required APIs enabled and nine Docker repositories created in `asia-southeast1`. | 2026-06-05 |
| Post-registry dev foundation plan | PASS; remaining plan is `9 to add, 0 to change, 0 to destroy`. | 2026-06-05 |
| GitHub OIDC/WIF targeted apply | PASS; IAM/STS APIs, WIF provider, deployer service account, and Artifact Registry writer bindings created. | 2026-06-05 |
| Post-WIF dev foundation plan | PASS; remaining plan is still `9 to add, 0 to change, 0 to destroy`. | 2026-06-05 |
| All-service deploy handoff | PASS; all nine service images were built, scanned, pushed, and written into the dev Kustomize overlay. | 2026-06-05 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Added Kustomize base, dev/staging overlays, service accounts, NetworkPolicy skeleton, Istio strict/default-deny skeleton, and Gateway/HTTPRoute skeleton. |
| 2026-06-04 | Added validated Terraform scaffold for GCS remote state bootstrap, dev network, private GKE, Artifact Registry repositories, and Cloud Armor policy foundation. No cloud resources applied. |
| 2026-06-04 | Added and validated workload manifests for all implemented services. |
| 2026-06-05 | Rephrased tracker for Codex-only non-service ownership and noted that cloud accounts are ready but project details are still needed before apply. |
| 2026-06-05 | Started Cloud Foundation Slice 1: added non-secret Terraform variable examples, ignored real backend config, documented the bootstrap/dev plan flow, and recorded validation evidence. Remote state bucket created in `aerobic-guide-498413-u6`; dev backend initialized; dev foundation plan passed (`24 add`). |
| 2026-06-05 | Applied the Artifact Registry slice through Terraform. Six project APIs and nine Docker repositories are now in remote state. The remaining foundation plan is network, Cloud Armor, and GKE only (`9 add`). |
| 2026-06-05 | Applied the GitHub OIDC/WIF deploy identity slice through Terraform. GitHub Actions can impersonate the deployer service account from `tns30-dev/aqua_scale` on `main` and push to the nine service repositories. |
| 2026-06-05 | Completed all-service image backfill. Artifact Registry and dev Kustomize are ready for GKE/Argo CD rollout once the runtime foundation is applied. |
