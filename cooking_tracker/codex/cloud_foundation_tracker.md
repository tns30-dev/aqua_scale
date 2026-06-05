# Cloud Foundation Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns GCP foundation, GKE, service mesh, Kubernetes manifests, Artifact Registry, and Terraform remote state.
- Current state: Terraform remote state bucket, nine Artifact Registry Docker repositories, GitHub OIDC/WIF deploy identity, VPC/subnet/secondary ranges, Cloud NAT, firewall rules, private service access, private-node GKE, Istio, Argo CD, managed Cloud SQL/Memorystore/Pub/Sub/Bigtable/BigQuery, the managed-backed nine-service runtime, AWS IoT/Lambda bridge, and public HTTPS API edge are live. `api.aquashield.live` resolves to static IP `8.232.154.25`, the Google-managed certificate is active, GKE Gateway backend is healthy, and Cloud Armor stays in the architecture design but is out of runtime evidence scope for this implementation.
- Current test: `terraform fmt`, Terraform validation, GKE node readiness, network/NAT/firewall verification, private service access verification, managed GCP resource checks, Gateway API availability, Istio control-plane readiness, Argo CD sync/health, managed dev runtime pod readiness, managed business-flow smoke, AWS bridge Terraform apply, AWS IoT MQTT smoke, Lambda logs, WIF proof, public edge server-side dry run, DNS/cert/backend health checks, and public HTTPS business-flow smoke.
- Next test: Firebase Hosting deploy, then DAST/performance evidence.
- Inputs ready from user: GCP account, project, region, zone, GKE, Istio, Argo CD, AWS profile, domain `aquashield.live`, and public API endpoint `https://api.aquashield.live` are selected.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Custom VPC | DONE | `aquashield-dev-vpc` is live with custom subnet mode and regional routing. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| GKE subnet | DONE | `aquashield-dev-gke-subnet` is live in `asia-southeast1` with CIDR `10.10.0.0/20`. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| Pod secondary range | DONE | VPC-native pod range `aquashield-dev-pods` is live with CIDR `10.20.0.0/16`. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| Service secondary range | DONE | VPC-native service range `aquashield-dev-services` is live with CIDR `10.30.0.0/20`. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| Private nodes | DONE | `aquashield-dev-gke` is running with private nodes; node has no external IP. | `../../infra/modules/gke/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| Cloud NAT | DONE | `aquashield-dev-vpc-nat` is live for all GKE subnet IP ranges. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| Private Google Access / PSC | DONE | Private Google Access is enabled on the GKE subnet and private service access is live for Cloud SQL/Memorystore private endpoints. | `../../infra/modules/network/`, `../../infra/modules/managed-data/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-apply.md` | 2026-06-05 |
| VPC firewall rules | DONE | Terraform health-check and internal GKE firewall rules are live; GKE also created managed cluster firewall rules. | `../../infra/modules/network/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| Kubernetes NetworkPolicy | DONE | Default-deny ingress, app-internal allow, GCLB health-check allow, and per-service policies are live in the full dev namespace. | `../../k8s/base/network/`, `../../k8s/base/services/`, `../../k8s/overlays/dev-full/`, `../../docs/evidence/gitops/2026-06-05-argocd-dev-full-rollout.md` | 2026-06-05 |
| Istio service mesh | DONE | Istio `1.30.1` control plane, CNI, sidecar injection, strict mTLS, and AuthorizationPolicy are live and proven on the full dev runtime. | `../../k8s/base/mesh/`, `../../k8s/base/services/`, `../../k8s/overlays/dev-full/`, `../../docs/evidence/gitops/2026-06-05-argocd-dev-full-rollout.md` | 2026-06-05 |
| Namespaces | DONE | `aquashield-dev` is live with `istio-injection=enabled`; staging remains manifest-only. | `../../k8s/overlays/dev/namespace.yaml`, `../../k8s/overlays/dev-smoke/namespace.yaml`, `../../k8s/overlays/staging/namespace.yaml` | 2026-06-05 |
| Service workload manifests | DONE | All nine implemented services have Deployment, Service, HPA, PDB, ConfigMap, NetworkPolicy, and AuthorizationPolicy manifests; `dev-managed` is live and healthy with analytics at `783c78a16381` and eight Java services at `bef15c6`. | `../../k8s/base/services/`, `../../k8s/overlays/dev-full/`, `../../k8s/overlays/dev-managed/`, `../../docs/evidence/k8s-*/`, `../../docs/evidence/gitops/2026-06-05-managed-business-flow-smoke.md`, `../../docs/evidence/terraform-foundation/2026-06-05-managed-data-apply.md` | 2026-06-05 |
| Artifact Registry | DONE | Nine per-service Docker repositories were created in `asia-southeast1` through Terraform state. CI image push remains tracked separately under CI/CD. | `../../infra/modules/artifact-registry/`, `../../docs/evidence/terraform-foundation/2026-06-05-artifact-registry-apply.md` | 2026-06-05 |
| Terraform remote state | DONE | State bucket created in project `aerobic-guide-498413-u6`; dev backend initialized against GCS. | `../../infra/bootstrap-state/`, `../../infra/environments/dev/backend.tf.example`, `../../docs/CLOUD_FOUNDATION_SLICE_1.md`, `../../docs/evidence/terraform-foundation/2026-06-05-cloud-foundation-slice-1-readiness.md` | 2026-06-05 |
| GitHub OIDC/WIF deploy identity | DONE | GitHub Actions provider, deployer service account, and per-repository Artifact Registry writer IAM bindings are managed in Terraform state. | `../../infra/modules/github-oidc/`, `../../docs/evidence/terraform-foundation/2026-06-05-github-oidc-deploy-handoff.md` | 2026-06-05 |
| AWS IoT/Lambda bridge Terraform | DONE | Module and dev root wiring are live behind local `enable_aws_iot_bridge=true`; Terraform created IoT thing/cert/policy/rule, Lambda/log role, GCP WIF provider/service account, and Pub/Sub publisher IAM. | `../../infra/modules/aws-iot-bridge/`, `../../docs/evidence/aws-iot-bridge/2026-06-05-code-readiness.md`, `../../docs/evidence/aws-iot-bridge/2026-06-05-live-deploy-and-smoke.md` | 2026-06-05 |
| Public API edge manifests | DONE | `dev-managed-public` is live through Argo on revision `960e98f`: GKE Gateway named address, HTTP redirect, pre-shared managed certificate, `/api` and `/ws` routes to `api-edge-proxy`, proxy health check, and business-flow smoke passed. | `../../k8s/base/services/api-edge-proxy/`, `../../k8s/overlays/dev-managed-public/`, `../../docs/evidence/public-edge/2026-06-05-public-edge-live-rollout.md` | 2026-06-05 |
| Public API static IP | DONE | Terraform created global static IP `8.232.154.25` as `aquashield-dev-api-edge` in `aerobic-guide-498413-u6`; DNS `api.aquashield.live` points to it and the GKE Gateway backend is healthy. | `../../infra/modules/api-edge/`, `../../docs/evidence/public-edge/2026-06-05-public-edge-https-ip-reservation.md`, `../../docs/evidence/public-edge/2026-06-05-public-edge-live-rollout.md` | 2026-06-05 |

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
| Managed data Terraform apply | PASS; private service access, Cloud SQL, Memorystore, Pub/Sub, Bigtable, BigQuery, runtime service accounts, and IAM bindings are live. | 2026-06-05 |
| Managed dev runtime rollout | PASS; Argo CD reports `Synced/Healthy` on `k8s/overlays/dev-managed`, and all nine services are ready. | 2026-06-05 |
| Managed business-flow smoke | PASS; Argo CD revision `a057b0b86f03834213b543d10e9b1fa0785eeda3` passed the signed telemetry business flow on managed GCP dependencies. | 2026-06-05 |
| AWS bridge Terraform validation | PASS; backend-free `terraform init`, `terraform fmt -recursive infra`, and `terraform validate` pass after adding the AWS provider/module. | 2026-06-05 |
| AWS credential check | PASS; profile `aquashield` resolves to AWS account `342327769401`. | 2026-06-05 |
| AWS bridge Terraform apply | PASS; Terraform applied 16 bridge resources with 0 changes and 0 destroys. | 2026-06-05 |
| AWS IoT MQTT smoke | PASS; certificate-authenticated MQTT publish through AWS IoT/Lambda reached managed GCP Pub/Sub and produced the expected business read models. | 2026-06-05 |
| Public edge server dry run | PASS; `kubectl apply --dry-run=server -k k8s/overlays/dev-managed-public` passed against the live GKE API server. | 2026-06-05 |
| Public edge static IP apply | PASS; Terraform applied `google_compute_global_address` `aquashield-dev-api-edge`, output `8.232.154.25`, with `1 added, 0 changed, 0 destroyed`. | 2026-06-05 |
| Public edge live apply | PASS; DNS `api.aquashield.live` resolves to `8.232.154.25`, managed certificate is `ACTIVE`, Gateway is programmed, backend health is `HEALTHY`, and Argo reports `Synced/Healthy` at `960e98f`. | 2026-06-05 |
| Public edge business smoke | PASS; full public HTTPS smoke produced `energyTotalKwh=3.1`, `activeAlerts=1`, `comparisonMetricCount=4`, `realtimeTokenMinted=true`, and `auditSecurityRows=6`. | 2026-06-05 |

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
| 2026-06-05 | Applied the managed GCP data/messaging slice and cut the live Argo CD Application to `k8s/overlays/dev-managed`; all nine services are healthy on managed runtime dependencies. |
| 2026-06-05 | Rebuilt Java services for real Pub/Sub credentials, rolled GitOps commit `a057b0b`, and recorded managed business-flow smoke evidence. |
| 2026-06-05 | Added AWS IoT/Lambda bridge Terraform with GCP WIF and Pub/Sub publisher-only IAM. Validation passed. |
| 2026-06-05 | Applied AWS IoT/Lambda bridge Terraform and proved x.509 MQTT delivery through AWS IoT, Lambda, GCP WIF, Pub/Sub, and the managed GKE business flow. |
| 2026-06-05 | Added public API edge manifest overlay with GKE Gateway/HTTPRoute/HealthCheckPolicy and recorded server-side dry-run evidence. Live apply is pending explicit approval or TLS/domain input. |
| 2026-06-05 | Switched public edge to HTTPS, added `api-edge-proxy`, and reserved global static IP `8.232.154.25` through Terraform; at that point live Gateway was waiting on real domain/DNS/managed certificate. |
| 2026-06-05 | Configured `api.aquashield.live`, created the Google-managed certificate, synced `dev-managed-public` through Argo, fixed public-edge mesh/proxy runtime issues, and proved the public HTTPS business flow. |
