# Managed Business-Flow Smoke Evidence - 2026-06-05

## Scope

End-to-end business smoke against the live `aquashield-dev` runtime backed by managed GCP services:

- Cloud SQL PostgreSQL private endpoint for service-owned schemas.
- Memorystore Redis private endpoint for authz snapshots and threshold cache.
- Google Pub/Sub real topics/subscriptions for telemetry and domain events.
- GKE private-node runtime with Istio sidecars and Argo CD GitOps.

## Runtime State

Argo CD final state:

```text
Synced Healthy a057b0b86f03834213b543d10e9b1fa0785eeda3
```

Deployment images:

```text
analytics-service         1/1  asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/analytics-service/analytics-service:783c78a16381
audit-service             1/1  asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/audit-service/audit-service:bef15c6
identity-access-service   1/1  asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/identity-access-service/identity-access-service:bef15c6
ingestion-service         1/1  asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/ingestion-service/ingestion-service:bef15c6
notification-service      1/1  asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/notification-service/notification-service:bef15c6
pond-service              1/1  asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/pond-service/pond-service:bef15c6
project-service           1/1  asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/project-service/project-service:bef15c6
realtime-gateway          1/1  asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/realtime-gateway/realtime-gateway:bef15c6
sensor-service            1/1  asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/sensor-service/sensor-service:bef15c6
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

## Smoke Command

The smoke used local `kubectl port-forward` bindings to the ClusterIP services and a Google OAuth access token for direct Pub/Sub REST publishing:

```text
GCP_ACCESS_TOKEN="$(gcloud auth print-access-token --account=aquashieldnus@gmail.com)" \
PUBSUB_PROJECT_ID=aerobic-guide-498413-u6 \
SMOKE_SUMMARY_PATH=/private/tmp/aq-managed-smoke-summary.json \
python3 scripts/smoke-managed-business-flow.py
```

## Business Assertions

Passed flow:

```text
identity login and audit emission
project catalogue and farm creation
pond setup
sensor type, device, and port mappings
threshold and energy settings
publish signed telemetry to real Pub/Sub
wait for ingestion, downstream alert, and read models
managed business-flow smoke passed
```

Smoke summary:

```json
{
  "activeAlerts": 1,
  "analyticsChartKeys": [],
  "auditSecurityRows": 3,
  "comparisonMetricCount": 4,
  "correlationId": "c2429478-f45c-4e02-9681-5f45f666fbab",
  "deviceCode": "DEV-CLOUD-SMOKE-20260605-140646",
  "energyTotalKwh": 3.1,
  "ponds": {
    "alpha": "057e8ce2-01d3-442d-97db-d033f2706b87",
    "beta": "1bf357a0-6ee2-4d08-8c5d-71f315dc65fd"
  },
  "projectId": "ff0a5448-de60-4e9d-a86e-78992771af80",
  "projectName": "Managed Smoke Farm 20260605-140646",
  "pubsubProject": "aerobic-guide-498413-u6",
  "pubsubTopic": "iot.telemetry.received",
  "realtimeTokenMinted": true
}
```

## Fixes Proven By This Smoke

- Removed the baked Spring Cloud Pub/Sub emulator property from Java service `application.yml` files so managed workloads use Workload Identity credentials.
- Kept emulator configuration explicit only in Docker Compose and `dev-full`.
- Rebuilt the eight Java service images with tag `bef15c6` and rolled them through GitOps.
- Made the smoke re-run safe by using a unique sensor `model_number`.
- Made alert evidence deterministic by keeping Pond Alpha pH above the configured threshold for the whole smoke run.
