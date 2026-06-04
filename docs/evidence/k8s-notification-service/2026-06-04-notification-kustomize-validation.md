# Notification Service Kustomize Validation

Date: 2026-06-04

## Scope

Added Kubernetes deployment integration for `notification-service`.

The service evaluates ingested readings against cached/project thresholds, stores alert lifecycle records, publishes alert/notification events, and exposes REST alert APIs:

- public REST route: `/api/alerts`
- internal ClusterIP service on port `8087`
- consumes `notification.reading.ingested.sub`
- consumes `notification.project.settings.updated.sub`
- calls `project-service:9092` over internal gRPC
- uses Redis for threshold cache
- uses Cloud SQL/PostgreSQL schema `notification`

## Files Added

- `k8s/base/services/notification-service/configmap.yaml`
- `k8s/base/services/notification-service/deployment.yaml`
- `k8s/base/services/notification-service/service.yaml`
- `k8s/base/services/notification-service/hpa.yaml`
- `k8s/base/services/notification-service/pdb.yaml`
- `k8s/base/services/notification-service/network-policy.yaml`
- `k8s/base/services/notification-service/authorization-policy.yaml`
- `k8s/base/services/notification-service/kustomization.yaml`

## Files Updated

- `k8s/base/kustomization.yaml`
- `k8s/base/edge/http-route.yaml`
- `cooking_tracker/codex/cloud_foundation_tracker.md`
- `cooking_tracker/codex/edge_and_frontend_tracker.md`

## Validation Commands

```bash
kubectl kustomize k8s/overlays/dev
kubectl kustomize k8s/overlays/staging
```

Result: both commands rendered successfully.

Targeted verification:

```bash
rg -n "name: notification-service|notification-service-config|containerPort: 8087|port: 8087|value: /api/alerts|READINGS_SUBSCRIPTION|SETTINGS_SUBSCRIPTION|PROJECT_GRPC_TARGET" /tmp/aquashield-dev.yaml
rg -n "name: notification-service|notification-service-config|containerPort: 8087|port: 8087|value: /api/alerts|READINGS_SUBSCRIPTION|SETTINGS_SUBSCRIPTION|PROJECT_GRPC_TARGET" /tmp/aquashield-staging.yaml
```

Result: both overlays include:

- `notification-service` ServiceAccount
- `notification-service-config`
- `READINGS_SUBSCRIPTION=notification.reading.ingested.sub`
- `SETTINGS_SUBSCRIPTION=notification.project.settings.updated.sub`
- `PROJECT_GRPC_TARGET=project-service:9092`
- Service/Deployment/NetworkPolicy port `8087`
- API Gateway route `/api/alerts` to `notification-service:8087`
- HPA/PDB
- Istio `notification-service-allow-http`

## Notes

- `PUBSUB_EMULATOR_HOST` is empty in K8s target config so the service uses managed Google Pub/Sub when deployed.
- `DB_PASSWORD` and `JWT_PUBLIC_KEY_PEM` are read from optional `notification-service-secrets`, matching the current Java service manifest pattern.
- Real cloud apply was not run in this step.
