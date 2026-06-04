# Cloud Foundation Tracker - Codex

Last updated: 2026-06-04

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary for Claude

- Current focus: Kustomize/GKE platform skeleton should live in root `k8s/`.
- Last completed: Dev/staging overlays render successfully with service accounts, Gateway/HTTPRoute skeleton, default NetworkPolicy, strict mTLS, default-deny AuthorizationPolicy, and Argo CD Application stubs.
- Blockers / questions: Real cloud provisioning still needs GCP project ID, region, domain/certificate decision, and repo URL for Argo CD.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Custom VPC | TODO | Terraform/cloud provisioning not started. | `../main/network_security.md` | — |
| GKE subnet | TODO | Terraform/cloud provisioning not started. | `../main/gke.md` | — |
| Pod secondary range | TODO | Terraform/cloud provisioning not started. | `../main/gke.md` | — |
| Service secondary range | TODO | Terraform/cloud provisioning not started. | `../main/gke.md` | — |
| Private nodes | TODO | Terraform/cloud provisioning not started. | `../main/gke.md` | — |
| Cloud NAT | TODO | Terraform/cloud provisioning not started. | `../main/network_security.md` | — |
| Private Google Access / PSC | TODO | Terraform/cloud provisioning not started. | `../main/network_security.md` | — |
| VPC firewall rules | TODO | Terraform/cloud provisioning not started. | `../main/network_security.md` | — |
| Kubernetes NetworkPolicy | IN_PROGRESS | Base default-deny ingress and GCLB allow policy should be restored under the flattened root layout; service-specific allow policies pending service deployments. | `../../k8s/base/network/` | 2026-06-04 |
| Istio service mesh | IN_PROGRESS | Namespace mesh labels, strict mTLS, and namespace default-deny AuthorizationPolicy should be restored under the flattened root layout; service-specific allow policies pending. | `../../k8s/base/mesh/` | 2026-06-04 |
| Namespaces | IN_PROGRESS | Dev and staging namespace manifests should be restored under the flattened root layout; not applied to a live cluster yet. | `../../k8s/overlays/dev/namespace.yaml`, `../../k8s/overlays/staging/namespace.yaml` | 2026-06-04 |
| Artifact Registry | TODO | Cloud repository creation not started. | `../main/ci.md`, `../main/cd.md` | — |
| Terraform remote state | TODO | GCS backend bucket not created yet. | `../main/terraform.md` | — |

## Validation

| Check | Result | Updated |
|---|---|---|
| `kubectl kustomize k8s/overlays/dev` | PENDING | 2026-06-04 |
| `kubectl kustomize k8s/overlays/staging` | PENDING | 2026-06-04 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Repo flattened to root layout; tracker paths updated from `aquashield/deploy/k8s` to `k8s`. Root K8s manifests need verification/restoration after restructure. |
| 2026-06-04 | Added Kustomize base, dev/staging overlays, service accounts, NetworkPolicy skeleton, Istio strict/default-deny skeleton, Gateway/HTTPRoute skeleton, and Argo CD Application stubs. |
