# Project Service K8s Validation - 2026-06-04

## Scope

Validated the deployable workload manifests for `project-service` after Claude completed the service implementation.

## Commands

| Command | Result |
|---|---|
| `kubectl kustomize k8s/overlays/dev` | PASS |
| `kubectl kustomize k8s/overlays/staging` | PASS |
| `find shared-api/events -name '*.json' -print0 \| xargs -0 -n1 jq empty` | PASS |

## Rendered Components

| Component | Location |
|---|---|
| ConfigMap | `k8s/base/services/project-service/configmap.yaml` |
| Deployment | `k8s/base/services/project-service/deployment.yaml` |
| Service | `k8s/base/services/project-service/service.yaml` |
| HorizontalPodAutoscaler | `k8s/base/services/project-service/hpa.yaml` |
| PodDisruptionBudget | `k8s/base/services/project-service/pdb.yaml` |
| NetworkPolicy | `k8s/base/services/project-service/network-policy.yaml` |
| Istio AuthorizationPolicy | `k8s/base/services/project-service/authorization-policy.yaml` |
| API route update | `k8s/base/edge/http-route.yaml` |
| Project event schemas | `shared-api/events/project.*.v1.json` |

## Notes

The service exposes REST on `8082` and gRPC on `9092`, matching `project-service/src/main/resources/application.yml` and the Dockerfile. Runtime secrets are referenced through `project-service-secrets` and are not committed.
