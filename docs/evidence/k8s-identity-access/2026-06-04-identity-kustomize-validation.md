# Identity Access K8s Validation - 2026-06-04

## Scope

Validated the first real service workload manifests for `identity-access-service`.

## Commands

| Command | Result |
|---|---|
| `kubectl kustomize k8s/overlays/dev` | PASS |
| `kubectl kustomize k8s/overlays/staging` | PASS |

## Rendered Components

| Component | Location |
|---|---|
| ConfigMap | `k8s/base/services/identity-access-service/configmap.yaml` |
| Deployment | `k8s/base/services/identity-access-service/deployment.yaml` |
| Service | `k8s/base/services/identity-access-service/service.yaml` |
| HorizontalPodAutoscaler | `k8s/base/services/identity-access-service/hpa.yaml` |
| PodDisruptionBudget | `k8s/base/services/identity-access-service/pdb.yaml` |
| NetworkPolicy | `k8s/base/services/identity-access-service/network-policy.yaml` |
| Istio AuthorizationPolicy | `k8s/base/services/identity-access-service/authorization-policy.yaml` |
| API route update | `k8s/base/edge/http-route.yaml` |

## Notes

The service exposes container and service port `8081`, matching the Spring Boot `SERVER_PORT` and Dockerfile. Runtime secrets are referenced through `identity-access-service-secrets` and are not committed.
