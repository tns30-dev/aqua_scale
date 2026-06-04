# Audit Service Kustomize Validation

Date: 2026-06-04

## Scope

- Added `audit-service` workload manifests to `k8s/base/services/audit-service`.
- Routed `/api/audit/**` through the Gateway API HTTPRoute to `audit-service:8092`.
- Added port `8092` to internal app and GCLB health-check NetworkPolicy allow lists.
- Configured the Audit Service with:
  - Cloud SQL/PostgreSQL schema owner `audit_svc`
  - Redis authz snapshot host/port
  - Pub/Sub project ID
  - dedicated `audit.audit.event.recorded.sub`
  - all audit business subscriptions from the decided catalogue
  - JWT issuer/audience and public-key secret reference

## Validation

Both overlay renders completed successfully:

```sh
kubectl kustomize k8s/overlays/dev
kubectl kustomize k8s/overlays/staging
```

## Result

PASS

Rendered manifests include:

- `ServiceAccount/audit-service`
- `ConfigMap/audit-service-config`
- `Deployment/audit-service`
- `Service/audit-service` on port `8092`
- `HorizontalPodAutoscaler/audit-service`
- `PodDisruptionBudget/audit-service`
- `NetworkPolicy/audit-service-ingress`
- `AuthorizationPolicy/audit-service-allow-http`
- HTTPRoute backend reference `/api/audit` -> `audit-service:8092`
