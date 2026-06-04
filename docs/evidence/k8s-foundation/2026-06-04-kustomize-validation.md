# K8s Foundation Validation - 2026-06-04

## Scope

Validated the restored root-level Kustomize platform foundation after the repo was flattened.

## Commands

| Command | Result |
|---|---|
| `kubectl kustomize k8s/overlays/dev` | PASS |
| `kubectl kustomize k8s/overlays/staging` | PASS |

## Rendered Components

| Component | Location |
|---|---|
| Dev namespace | `k8s/overlays/dev/namespace.yaml` |
| Staging namespace | `k8s/overlays/staging/namespace.yaml` |
| Service accounts | `k8s/base/service-accounts.yaml` |
| GKE Gateway | `k8s/base/edge/gateway.yaml` |
| HTTPS redirect route | `k8s/base/edge/http-redirect.yaml` |
| REST and WSS routes | `k8s/base/edge/http-route.yaml` |
| Network policies | `k8s/base/network/` |
| Istio strict mTLS/default-deny | `k8s/base/mesh/` |

## Notes

Service Deployment, Service, HPA, and PodDisruptionBudget manifests are intentionally not included yet. They should be added after the service skeletons define actual image names, ports, probes, and runtime configuration.
