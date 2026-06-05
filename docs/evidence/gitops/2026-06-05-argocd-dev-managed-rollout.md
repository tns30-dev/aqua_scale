# Argo CD Dev Managed Runtime Rollout Evidence - 2026-06-05

## Scope

Switched the live `aquashield-dev` Argo CD Application from in-cluster dev dependencies to managed GCP data and messaging.

GitOps source:

```text
repo: https://github.com/tns30-dev/aqua_scale.git
targetRevision: main
path: k8s/overlays/dev-managed
revision: a057b0b86f03834213b543d10e9b1fa0785eeda3
```

## Rollout Result

Argo CD final state:

```text
Synced
Healthy
a057b0b86f03834213b543d10e9b1fa0785eeda3
```

Deployment readiness:

```text
analytics-service         1/1
audit-service             1/1
identity-access-service   1/1
ingestion-service         1/1
notification-service      1/1
pond-service              1/1
project-service           1/1
realtime-gateway          1/1
sensor-service            1/1
```

Pod readiness:

```text
analytics-service         2/2 Running
audit-service             2/2 Running
identity-access-service   2/2 Running
ingestion-service         2/2 Running
notification-service      2/2 Running
pond-service              2/2 Running
project-service           2/2 Running
realtime-gateway          2/2 Running
sensor-service            2/2 Running
cloudsql-bootstrap        Completed
```

## Managed Runtime Config Proof

Live ConfigMaps use managed private endpoints:

```text
project-service-config
DB_HOST=10.128.1.3
REDIS_HOST=10.128.0.3
PUBSUB_PROJECT_ID=aerobic-guide-498413-u6
PUBSUB_EMULATOR_HOST=
SPRING_AUTOCONFIGURE_EXCLUDE=com.google.cloud.spring.autoconfigure.pubsub.GcpPubSubEmulatorAutoConfiguration

analytics-service-config
REDIS_URL=redis://10.128.0.3:6379
```

The final fix removes `spring.cloud.gcp.pubsub.emulator-host` from each Java service `application.yml`. Local Compose and `dev-full` now set `SPRING_CLOUD_GCP_PUBSUB_EMULATOR_HOST` explicitly. The managed overlay excludes Spring's emulator auto-configuration and leaves the legacy `PUBSUB_EMULATOR_HOST` key empty for compatibility.

## Fixes During Cutover

- Cloud SQL bootstrap now creates schemas by connecting as each service role after the admin user grants `CONNECT, CREATE`. This is required because Cloud SQL's `postgres` user is not a true PostgreSQL superuser.
- Managed Pub/Sub requires removing the baked Spring emulator-host property from the service artifacts; setting `PUBSUB_EMULATOR_HOST` alone was not sufficient.
- The managed rollout annotation now appends a single key under existing pod-template annotations instead of replacing the annotation map, preserving small Istio proxy resource requests.
- A temporary node-pool max increase hit `SSD_TOTAL_GB` quota; after preserving proxy requests, all pods scheduled and became healthy on the existing two nodes.
- Java service images were rebuilt at tag `bef15c6` and rolled by GitOps commit `a057b0b`.
