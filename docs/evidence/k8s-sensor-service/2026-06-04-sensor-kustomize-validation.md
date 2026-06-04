# Sensor Service K8s Validation - 2026-06-04

## Scope

Validated the deployable workload manifests for `sensor-service` after Claude completed the service implementation.

## Commands

| Command | Result |
|---|---|
| `kubectl kustomize k8s/overlays/dev` | PASS |
| `kubectl kustomize k8s/overlays/staging` | PASS |
| `find shared-api/events -name '*.json' -print0 \| xargs -0 -n1 jq empty` | PASS |

## Rendered Components

| Component | Location |
|---|---|
| ConfigMap | `k8s/base/services/sensor-service/configmap.yaml` |
| Deployment | `k8s/base/services/sensor-service/deployment.yaml` |
| Service | `k8s/base/services/sensor-service/service.yaml` |
| HorizontalPodAutoscaler | `k8s/base/services/sensor-service/hpa.yaml` |
| PodDisruptionBudget | `k8s/base/services/sensor-service/pdb.yaml` |
| NetworkPolicy | `k8s/base/services/sensor-service/network-policy.yaml` |
| Istio AuthorizationPolicy | `k8s/base/services/sensor-service/authorization-policy.yaml` |
| API route update | `k8s/base/edge/http-route.yaml` |
| Sensor event schemas | `shared-api/events/device.*.v1.json`, `shared-api/events/project.sensor.*.v1.json` |

## Notes

The service exposes REST on `8083` and gRPC on `9093`, matching `sensor-service/src/main/resources/application.yml` and the Dockerfile. The edge route includes the nested project sensor mapping path `/api/projects/{projectId}/sensors`; if the selected Gateway controller does not support regex path matches at apply time, add a Sensor-owned REST alias and keep Project-owned `/api/projects/**` isolated.
