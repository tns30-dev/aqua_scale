# Ingestion Service Kustomize Validation

Date: 2026-06-04

## Scope

Added Kubernetes deployment integration for `ingestion-service`.

The service is an internal Pub/Sub worker:

- no public `HTTPRoute`
- no API Gateway route
- internal ClusterIP service on port `8084`
- actuator health/metrics only
- calls `sensor-service:9093` and `project-service:9092` over internal gRPC
- consumes `ingestion.iot.telemetry.received.sub`

## Files Added

- `k8s/base/services/ingestion-service/configmap.yaml`
- `k8s/base/services/ingestion-service/deployment.yaml`
- `k8s/base/services/ingestion-service/service.yaml`
- `k8s/base/services/ingestion-service/hpa.yaml`
- `k8s/base/services/ingestion-service/pdb.yaml`
- `k8s/base/services/ingestion-service/network-policy.yaml`
- `k8s/base/services/ingestion-service/authorization-policy.yaml`
- `k8s/base/services/ingestion-service/kustomization.yaml`

## Files Updated

- `k8s/base/kustomization.yaml`
- `k8s/base/network/allow-app-internal-traffic.yaml`

## Validation Commands

```bash
kubectl kustomize k8s/overlays/dev
kubectl kustomize k8s/overlays/staging
```

Result: both commands rendered successfully.

Targeted verification:

```bash
kubectl kustomize k8s/overlays/dev | rg -n "name: ingestion-service|ingestion-service-config|INGESTION_SUBSCRIPTION|SENSOR_GRPC_TARGET|PROJECT_GRPC_TARGET|port: 8084|ingestion-service-allow-actuator|maxReplicas: 6"
kubectl kustomize k8s/overlays/staging | rg -n "name: ingestion-service|ingestion-service-config|INGESTION_SUBSCRIPTION|SENSOR_GRPC_TARGET|PROJECT_GRPC_TARGET|port: 8084|ingestion-service-allow-actuator|maxReplicas: 6"
```

Result: both overlays include:

- `ingestion-service` ServiceAccount
- `ingestion-service-config`
- `INGESTION_SUBSCRIPTION=ingestion.iot.telemetry.received.sub`
- `SENSOR_GRPC_TARGET=sensor-service:9093`
- `PROJECT_GRPC_TARGET=project-service:9092`
- Service/NetworkPolicy port `8084`
- HPA `maxReplicas: 6`
- Istio `ingestion-service-allow-actuator`

## Notes

- Ingestion remains off the public API edge.
- `PUBSUB_EMULATOR_HOST` is empty in K8s target config so the service uses managed Google Pub/Sub when deployed.
- `DB_PASSWORD` is read from optional `ingestion-service-secrets` to match the current service manifest pattern.
- Real cloud apply was not run in this step.
