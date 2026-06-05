# Argo CD Dev Managed Runtime Rollout Evidence - 2026-06-05

## Scope

Switched the live `aquashield-dev` Argo CD Application from in-cluster dev dependencies to managed GCP data and messaging.

GitOps source:

```text
repo: https://github.com/tns30-dev/aqua_scale.git
targetRevision: main
path: k8s/overlays/dev-managed
revision: 829227a3a6868b8844f62ca6a573bf36fb90fbaa
```

## Rollout Result

Argo CD final state:

```text
Synced
Healthy
829227a3a6868b8844f62ca6a573bf36fb90fbaa
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
PUBSUB_EMULATOR_HOST=<absent>

analytics-service-config
REDIS_URL=redis://10.128.0.3:6379
```

The `PUBSUB_EMULATOR_HOST` key is intentionally removed in the managed overlay. Keeping it as an empty string triggered Spring Cloud GCP emulator auto-configuration, so the final overlay removes the key entirely.

## Fixes During Cutover

- Cloud SQL bootstrap now creates schemas by connecting as each service role after the admin user grants `CONNECT, CREATE`. This is required because Cloud SQL's `postgres` user is not a true PostgreSQL superuser.
- Managed Pub/Sub requires removing `PUBSUB_EMULATOR_HOST`, not setting it to an empty string.
- The managed rollout annotation now appends a single key under existing pod-template annotations instead of replacing the annotation map, preserving small Istio proxy resource requests.
- A temporary node-pool max increase hit `SSD_TOTAL_GB` quota; after preserving proxy requests, all pods scheduled and became healthy on the existing two nodes.
