# Pond Service Kustomize Validation

Date: 2026-06-04

## Scope

Added the GKE/Kustomize deployment integration for `pond-service` after the service implementation was completed.

## Runtime Contract

| Item | Value |
|---|---|
| HTTP port | `8089` |
| gRPC port | `9094` |
| Service account | `pond-service` |
| Database user | `pond_svc` |
| ConfigMap | `pond-service-config` |
| Optional secret | `pond-service-secrets` |
| Project dependency | `PROJECT_GRPC_TARGET=project-service:9092` |

## Edge Routes

| Route | Backend |
|---|---|
| `/api/ponds` | `pond-service:8089` |
| `/api/cycles` | `pond-service:8089` |
| `/api/treatments` | `pond-service:8089` |
| `/api/pond-treatments` | `pond-service:8089` |
| `^/api/projects/[^/]+/ponds(/.*)?$` | `pond-service:8089` |
| `^/api/projects/[^/]+/pond-comparison(/.*)?$` | `pond-service:8089` |

The nested project routes are intentionally listed before the general `/api/projects` route so create-pond and pond-comparison requests are not routed to `project-service`.

## Validation Commands

```bash
kubectl kustomize k8s/overlays/dev > /tmp/aquashield-dev.yaml
kubectl kustomize k8s/overlays/staging > /tmp/aquashield-staging.yaml
```

## Validation Result

Passed.

Both commands rendered successfully:

```text
kubectl kustomize k8s/overlays/dev
kubectl kustomize k8s/overlays/staging
```

Focused verification against the rendered manifests confirmed:

| Check | Result |
|---|---|
| `pond-service` ServiceAccount is present | Passed |
| `pond-service-config` ConfigMap is present | Passed |
| HTTP `8089` and gRPC `9094` are exposed by Service/Deployment | Passed |
| Gateway API routes point pond endpoints to `pond-service:8089` | Passed |
| Shared app internal NetworkPolicy allows `8089` and `9094` | Passed |
| GCLB health-check NetworkPolicy allows `8089` | Passed |
| Project gRPC dependency is configured as `project-service:9092` | Passed |
