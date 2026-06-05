# Public API HTTPS Edge Live Rollout - 2026-06-05

## Scope

This evidence proves the production-style public API edge for the managed-backed dev runtime:

- Domain: `api.aquashield.live`
- Static IP: `8.232.154.25`
- GCP managed certificate: `aquashield-dev-api-edge`
- GKE Gateway: `aquashield-api-gateway`
- Public routes: `/api` and `/ws`
- In-cluster edge proxy: `api-edge-proxy`
- Runtime backing services: managed Cloud SQL, Memorystore Redis, real Pub/Sub, Bigtable, and BigQuery.

## DNS And Certificate

Namecheap DNS was configured with:

```text
A api -> 8.232.154.25
```

DNS resolved from local and Google public DNS:

```text
dig +short api.aquashield.live
8.232.154.25

dig @8.8.8.8 +short api.aquashield.live
8.232.154.25
```

Terraform then created the Google-managed certificate:

```text
module.api_edge[0].google_compute_managed_ssl_certificate.api[0]
domains = ["api.aquashield.live"]

Apply complete! Resources: 1 added, 0 changed, 0 destroyed.
```

Final certificate status:

```text
aquashield-dev-api-edge  MANAGED  ACTIVE  api.aquashield.live=ACTIVE
```

## GitOps Rollout

Argo CD Application:

```text
sync: Synced
health: Healthy
revision: 960e98f88c697952977b63f933a5ae7ff5ba5bd2
operation: Succeeded
message: successfully synced (all tasks run)
```

Gateway and public edge workload:

```text
gateway.gateway.networking.k8s.io/aquashield-api-gateway
address: 8.232.154.25
programmed: True

httproute.gateway.networking.k8s.io/aquashield-api-routes
hostnames: ["api.aquashield.live"]

deployment.apps/api-edge-proxy
ready: 1/1
```

The load balancer backend is healthy:

```text
healthState: HEALTHY
ipAddress: 10.20.1.72
port: 8080
annotations.itls: istio
```

The proxy allows Google health checks through a workload-scoped Istio exception while preserving namespace strict mTLS for the service mesh:

```text
api-edge-proxy-permissive-ingress   PERMISSIVE
default-strict-mtls                 STRICT
```

## Runtime Fixes During Rollout

Two public-edge issues were found and fixed through GitOps:

- GCLB health checks could not reach the proxy while namespace mTLS was `STRICT`; fixed with workload-scoped `PeerAuthentication` for `api-edge-proxy`.
- Nginx originally forwarded the external host into mesh upstreams and used default upstream HTTP behavior; fixed by using Kubernetes service hostnames, proxying upstream services with HTTP/1.1, and rolling the pod template.

Relevant commits:

```text
f5f1475 fix(edge): allow gclb health checks through mesh
bce7b87 fix(edge): use service hosts for mesh upstreams
63477f0 fix(ci): audit smoke urllib requests
960e98f fix(edge): proxy upstream services over http11
```

## CI/SAST Recovery

The SAST failure shown during the edge rollout was from Semgrep's dynamic `urllib` rule against the business-smoke helper. The smoke script now validates all URLs as HTTP/HTTPS before opening them and suppresses the scanner rule only at the audited wrapper.

Latest CI run after the fix:

```text
run: 27004222745
commit: 960e98f88c697952977b63f933a5ae7ff5ba5bd2
status: completed
conclusion: success

secret-scan: success
sast: success
sca-and-secrets-fs: success
sbom: success
ci-summary: success
```

## Public API Smoke

Status-only checks:

```text
POST https://api.aquashield.live/api/auth/login with bad password -> 401
POST https://api.aquashield.live/api/auth/login with seeded admin -> 200
GET  https://api.aquashield.live/api/profile-types without token -> 401
```

Full managed business-flow smoke ran with every service base URL set to `https://api.aquashield.live`:

```text
IDENTITY_BASE=https://api.aquashield.live
PROJECT_BASE=https://api.aquashield.live
POND_BASE=https://api.aquashield.live
SENSOR_BASE=https://api.aquashield.live
NOTIFICATION_BASE=https://api.aquashield.live
ANALYTICS_BASE=https://api.aquashield.live
REALTIME_BASE=https://api.aquashield.live
AUDIT_BASE=https://api.aquashield.live
PUBSUB_PROJECT_ID=aerobic-guide-498413-u6
python3 scripts/smoke-managed-business-flow.py
```

Result:

```json
{
  "activeAlerts": 1,
  "analyticsChartKeys": [],
  "auditSecurityRows": 6,
  "comparisonMetricCount": 4,
  "correlationId": "e9712907-7920-4da2-b71b-735f1d5c7562",
  "deviceCode": "DEV-CLOUD-SMOKE-20260605-162945",
  "energyTotalKwh": 3.1,
  "projectId": "fa9b532c-a194-4521-a2cc-02101987edab",
  "projectName": "Managed Smoke Farm 20260605-162945",
  "publisher": "pubsub",
  "pubsubProject": "aerobic-guide-498413-u6",
  "pubsubTopic": "iot.telemetry.received",
  "realtimeTokenMinted": true
}
```

This proves public HTTPS routing through the GKE Gateway and `api-edge-proxy` into the managed-backed microservice runtime for:

- identity login and audit emission
- project creation and access refresh
- pond creation
- sensor type, device, and port mapping
- signed telemetry publish to real Pub/Sub
- ingestion persistence/read model propagation
- threshold alert creation
- energy dashboard read model
- pond comparison metrics
- analytics chart endpoint
- realtime token minting
- audit security query

## Remaining Edge Work

Firebase Hosting is the next slice. It should use:

```text
VITE_API_BASE_URL=https://api.aquashield.live
VITE_WS_BASE_URL=wss://api.aquashield.live
```

Cloud Armor remains design-only for this implementation scope, and DAST/performance evidence remains pending.
