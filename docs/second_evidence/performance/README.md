# Second-Round Performance Evidence

## Current Status

| Evidence item | Status | Notes |
|---|---|---|
| Test-case definition | Done | See `docs/evidence/performance/test_cases.md` |
| Local Docker Compose results | Done | 50 concurrent users, 4,000,000+ readings, all p95 values under 3 sec |
| Cloud-native results | Done | See `cloud_native_results.md`; GitHub k6 artifacts are stored under `artifacts/cloud-*` |

## Local Result Source

The current local result table is recorded at:

```text
docs/evidence/performance/local_results.md
```

The important local result is:

```text
Busy-day 50 users: 37.3 ms overall p95
Charts p95: 875.4 ms
Pond comparison p95: 153.1 ms
WebSocket connect p95: 34.2 ms
Mixed bad-day HTTP p95: 67.0 ms
Pub/Sub drain: 400 / 400 rows stored in under 1 sec
```

## Cloud-Native Result Target

Cloud-native results were recorded against the deployed microservice gateway:

Current target project:

```text
aquashield-ms-dev-20260808
```

Use `k8s/overlays/performance-managed-public` for the final managed GCP/public
edge performance run.

Current gateway IP:

```text
34.54.25.36
```
