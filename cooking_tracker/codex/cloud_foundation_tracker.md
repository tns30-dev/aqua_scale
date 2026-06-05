# Cloud Foundation Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns GCP foundation, GKE, service mesh, Kubernetes manifests, Artifact Registry, and Terraform remote state.
- Current state: Terraform remote state bucket, nine Artifact Registry Docker repositories, GitHub OIDC/WIF deploy identity, VPC/subnet/secondary ranges, Cloud NAT, firewall rules, private-node GKE, Istio, Argo CD, and the full nine-service `dev-full` runtime are live in project `aerobic-guide-498413-u6`. Managed GCP data-service Terraform and `dev-managed` overlay are code-ready. Cloud Armor stays in the architecture design but is out of runtime evidence scope for this implementation.
- Current test: `terraform fmt`, GKE node readiness, network/NAT/firewall verification, Gateway API availability, Istio control-plane readiness, Argo CD sync/health, full dev runtime pod readiness, and `kubectl kustomize k8s/overlays/dev-managed`.
- Next test: Refresh Terraform ADC for `aquashieldnus@gmail.com`, apply managed data/messaging resources, create Kubernetes secrets from Terraform outputs, and cut Argo from `dev-full` to `dev-managed`.
- Inputs ready from user: GCP account, project, region, zone, GKE, Istio, and Argo CD are selected. Still need domain/certificate choice for public edge evidence and data-runtime cost ceiling.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Custom VPC | DONE | `aquashield-dev-vpc` is live with custom subnet mode and regional routing. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| GKE subnet | DONE | `aquashield-dev-gke-subnet` is live in `asia-southeast1` with CIDR `10.10.0.0/20`. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| Pod secondary range | DONE | VPC-native pod range `aquashield-dev-pods` is live with CIDR `10.20.0.0/16`. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| Service secondary range | DONE | VPC-native service range `aquashield-dev-services` is live with CIDR `10.30.0.0/20`. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| Private nodes | DONE | `aquashield-dev-gke` is running with private nodes; node has no external IP. | `../../infra/modules/gke/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| Cloud NAT | DONE | `aquashield-dev-vpc-nat` is live for all GKE subnet IP ranges. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| Private Google Access / PSC | IN_PROGRESS | Private Google Access is enabled on the GKE subnet; private service access support is added to the network module for Cloud SQL and Memorystore but apply evidence is pending managed data plan/apply. | `../../infra/modules/network/`, `../../infra/modules/managed-data/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-slice-code-readiness.md` | 2026-06-05 |
| VPC firewall rules | DONE | Terraform health-check and internal GKE firewall rules are live; GKE also created managed cluster firewall rules. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| Kubernetes NetworkPolicy | DONE | Default-deny ingress, app-internal allow, GCLB health-check allow, and per-service policies are live in the full dev namespace. | `../../k8s/base/network/`, `../../k8s/base/services/`, `../../k8s/overlays/dev-full/`, `../../docs/evidence/gitops/2026-06-05-argocd-dev-full-rollout.md` | 2026-06-05 |
| Istio service mesh | DONE | Istio `1.30.1` control plane, CNI, sidecar injection, strict mTLS, and AuthorizationPolicy are live and proven on the full dev runtime. | `../../k8s/base/mesh/`, `../../k8s/base/services/`, `../../k8s/overlays/dev-full/`, `../../docs/evidence/gitops/2026-06-05-argocd-dev-full-rollout.md` | 2026-06-05 |
| Namespaces | DONE | `aquashield-dev` is live with `istio-injection=enabled`; staging remains manifest-only. | `../../k8s/overlays/dev/namespace.yaml`, `../../k8s/overlays/dev-smoke/namespace.yaml`, `../../k8s/overlays/staging/namespace.yaml` | 2026-06-05 |
| Service workload manifests | DONE | All nine implemented services have Deployment, Service, HPA, PDB, ConfigMap, NetworkPolicy, and AuthorizationPolicy manifests; `dev-full` is live and healthy on Artifact Registry tag `783c78a16381`. `dev-managed` is code-ready for the managed data cutover. | `../../k8s/base/services/`, `../../k8s/overlays/dev-full/`, `../../k8s/overlays/dev-managed/`, `../../docs/evidence/k8s-*/`, `../../docs/evidence/gitops/2026-06-05-argocd-dev-full-rollout.md`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-slice-code-readiness.md` | 2026-06-05 |
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
| Fresh runtime foundation plan | PASS; `/tmp/aquashield-dev-foundation-runtime.tfplan` proposes `9 to add, 0 to change, 0 to destroy` in `aerobic-guide-498413-u6`. | 2026-06-05 |
| Runtime foundation apply | PASS; VPC, subnet, secondary ranges, NAT, firewall, GKE cluster, and node pool are live. Cloud Armor is intentionally disabled for dev runtime evidence. | 2026-06-05 |
| Final Terraform plan | PASS; with Cloud Armor disabled for dev evidence scope, Terraform reports no changes. | 2026-06-05 |
| GKE node readiness | PASS; single private `e2-standard-2` node is `Ready`. | 2026-06-05 |
| Istio control plane | PASS; Istio CRDs, CNI, `istiod`, and GatewayClass are live. | 2026-06-05 |
| Argo CD GitOps sync | PASS; `aquashield-dev` synced `k8s/overlays/dev-smoke` from commit `6ce1f08` and reported `Synced/Healthy`. | 2026-06-05 |
| Analytics smoke workload | PASS; one pod is `2/2 Running`, HPA is capped at 1, strict mTLS is enabled, and `/healthz` returned `{"status":"UP"}`. | 2026-06-05 |
| Full dev overlay rollout | PASS; Argo reports `Synced/Healthy` on `k8s/overlays/dev-full` at revision `9545374571ff969a34c11152850bc1ed56852c3c`, and all nine service pods are ready. | 2026-06-05 |
| Managed GCP overlay render | PASS; `kubectl kustomize k8s/overlays/dev-managed` renders with emulator resources pruned, Workload Identity annotations added, and Cloud SQL/Memorystore placeholders ready for Terraform outputs. | 2026-06-05 |
| Managed data Terraform validation | PASS; backend-free temporary validation succeeds. Remote-state plan/apply is blocked because active gcloud account is `aquashieldnus@gmail.com`, but Terraform ADC still points at `acceclaim.user@gmail.com`. Need ADC refresh before remote-state plan/apply. | 2026-06-05 |

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
| 2026-06-05 | Aligned local `gcloud` project to `aerobic-guide-498413-u6` and regenerated the runtime foundation plan at `/tmp/aquashield-dev-foundation-runtime.tfplan`; remaining plan is `9 add`. |
| 2026-06-05 | Applied the runtime foundation. GKE/network resources are live and Terraform is clean. Cloud Armor remains architecture/design-only for this implementation and is disabled in dev Terraform. |
| 2026-06-05 | Installed Istio and Argo CD, granted the GKE node service account Artifact Registry reader, capped dev autoscaling for free-credit quota, and proved the live analytics smoke slice through Argo CD. |
| 2026-06-05 | Promoted the live GitOps application to `k8s/overlays/dev-full`; all nine services are ready on in-cluster dev dependencies and Argo reports `Synced/Healthy`. |
| 2026-06-05 | Added private service access support, managed data/messaging Terraform code, and `k8s/overlays/dev-managed` for the Cloud SQL/Memorystore/Pub/Sub/Bigtable/BigQuery cutover path. |
