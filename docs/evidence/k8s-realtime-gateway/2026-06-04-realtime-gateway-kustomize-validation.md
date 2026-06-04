# Realtime Gateway Kustomize Validation

Date: 2026-06-04

## Scope

Added Kubernetes deployment integration for `realtime-gateway`.

The service is the public WSS push layer:

- public REST token mint route: `POST /ws/token`
- public WebSocket upgrade route: `/ws`
- internal ClusterIP service on port `8088`
- uses Redis for one-time WebSocket tokens, replay protection, subscriptions, and cross-pod fanout
- consumes `realtime.reading.ingested.sub`
- consumes `realtime.alert.created.sub`
- consumes `realtime.alert.resolved.sub`
- pushes browser frames for sensor readings and alert lifecycle events

## Files Added

- `k8s/base/services/realtime-gateway/configmap.yaml`
- `k8s/base/services/realtime-gateway/deployment.yaml`
- `k8s/base/services/realtime-gateway/service.yaml`
- `k8s/base/services/realtime-gateway/hpa.yaml`
- `k8s/base/services/realtime-gateway/pdb.yaml`
- `k8s/base/services/realtime-gateway/network-policy.yaml`
- `k8s/base/services/realtime-gateway/authorization-policy.yaml`
- `k8s/base/services/realtime-gateway/kustomization.yaml`

## Files Updated

- `k8s/base/kustomization.yaml`
- `k8s/base/edge/http-route.yaml`
- `k8s/base/network/allow-app-internal-traffic.yaml`
- `k8s/base/network/allow-gclb-health-checks.yaml`
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
rg -n "name: realtime-gateway|realtime-gateway-config|containerPort: 8088|port: 8088|value: /ws|READINGS_SUBSCRIPTION|ALERT_CREATED_SUBSCRIPTION|ALERT_RESOLVED_SUBSCRIPTION|WS_ALLOWED_ORIGINS|realtime-gateway-allow-http-ws" /tmp/aquashield-dev.yaml
rg -n "name: realtime-gateway|realtime-gateway-config|containerPort: 8088|port: 8088|value: /ws|READINGS_SUBSCRIPTION|ALERT_CREATED_SUBSCRIPTION|ALERT_RESOLVED_SUBSCRIPTION|WS_ALLOWED_ORIGINS|realtime-gateway-allow-http-ws" /tmp/aquashield-staging.yaml
```

Result: both overlays include:

- `realtime-gateway` ServiceAccount
- `realtime-gateway-config`
- `READINGS_SUBSCRIPTION=realtime.reading.ingested.sub`
- `ALERT_CREATED_SUBSCRIPTION=realtime.alert.created.sub`
- `ALERT_RESOLVED_SUBSCRIPTION=realtime.alert.resolved.sub`
- Firebase-origin `WS_ALLOWED_ORIGINS` placeholder
- Service/Deployment/NetworkPolicy port `8088`
- API Gateway route `/ws` to `realtime-gateway:8088`
- HPA/PDB
- Istio `realtime-gateway-allow-http-ws`
- shared NetworkPolicy ingress allow ports `8087` and `8088`

## Notes

- Public browser traffic remains WSS. TLS terminates at the GCP external HTTPS load balancer/Gateway edge; the in-cluster service listens on HTTP port `8088`.
- `PUBSUB_EMULATOR_HOST` is empty in K8s target config so the service uses managed Google Pub/Sub when deployed.
- `JWT_PUBLIC_KEY_PEM` is read from optional `realtime-gateway-secrets`, matching the current Java service manifest pattern.
- Real cloud apply was not run in this step.
