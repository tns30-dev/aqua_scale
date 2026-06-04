# Analytics Service Kustomize Validation

Date: 2026-06-04

## Scope

Added the GKE/Kustomize deployment integration for `analytics-service` after the TypeScript/Express implementation was completed.

## Runtime Contract

| Item | Value |
|---|---|
| HTTP port | `8090` |
| Health endpoint | `/healthz` |
| Service account | `analytics-service` |
| ConfigMap | `analytics-service-config` |
| Optional secret | `analytics-service-secrets` |
| Project dependency | `PROJECT_GRPC_TARGET=project-service:9092` |
| Pond dependency | `POND_GRPC_TARGET=pond-service:9094` |
| Ingestion dependency | `INGESTION_GRPC_TARGET=ingestion-service:9095` |
| Redis metadata cache | `analytics:chart-config:{projectId}` |

## Edge Routes

| Route | Backend |
|---|---|
| `^/api/projects/[^/]+/charts/?$` | `analytics-service:8090` |
| `/api/analytics` | `analytics-service:8090` |

The project chart route is intentionally listed before the general `/api/projects` route so historical chart package requests are not routed to `project-service`.

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
| `analytics-service` ServiceAccount is present | Passed |
| `analytics-service-config` ConfigMap is present | Passed |
| HTTP `8090` is exposed by Service/Deployment | Passed |
| Gateway API chart route points to `analytics-service:8090` before `/api/projects` | Passed |
| Shared app internal NetworkPolicy allows `8090` | Passed |
| GCLB health-check NetworkPolicy allows `8090` | Passed |
| Project/Pond/Ingestion gRPC dependencies are configured | Passed |
| `/healthz` probes are configured | Passed |
