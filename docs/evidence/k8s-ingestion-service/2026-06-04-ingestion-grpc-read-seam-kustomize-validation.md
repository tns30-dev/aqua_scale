# Ingestion gRPC Read Seam Kustomize Validation

Date: 2026-06-04

## Scope

Updated the existing `ingestion-service` GKE/Kustomize deployment integration after the `GetReadings` gRPC read seam was added.

## Runtime Contract

| Item | Value |
|---|---|
| HTTP port | `8084` |
| gRPC read port | `9095` |
| Service account | `ingestion-service` |
| gRPC consumer | `analytics-service` |
| RPC | `GetReadings` |

## K8s Changes

| Resource | Update |
|---|---|
| ConfigMap | Added `GRPC_PORT=9095` |
| Deployment | Added container port `grpc:9095` |
| Service | Added ClusterIP service port `grpc:9095` |
| NetworkPolicy | Allowed in-cluster TCP `9095` |
| Istio AuthorizationPolicy | Allowed TCP `9095` under strict mTLS/default-deny |
| Shared app NetworkPolicy | Added `9095` to app-internal allowlist |

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
| `GRPC_PORT=9095` is present in `ingestion-service-config` | Passed |
| Deployment exposes container port `9095` | Passed |
| Service exposes ClusterIP port `9095` | Passed |
| Ingestion-specific NetworkPolicy allows `9095` | Passed |
| Shared app internal NetworkPolicy allows `9095` | Passed |
| Istio AuthorizationPolicy allows TCP `9095` | Passed |
