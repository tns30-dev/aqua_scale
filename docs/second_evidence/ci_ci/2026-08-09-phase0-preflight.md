# Phase 0 — Preflight Environment Proof (2026-08-09)

Plan: `docs/second_evidence/ci_ci/local.md`. All checks run on the local
Docker Compose stack; no cloud resources touched.

## Compose stack health

`docker compose --profile app ps` — 14/14 containers up, all app services
healthy:

| Container | Image | Status |
|---|---|---|
| aq-identity, aq-project, aq-sensor, aq-ingestion, aq-notification, aq-realtime, aq-pond, aq-analytics, aq-audit | `aquashield-local-*` | Up, healthy |
| aq-gateway | nginx:1.27-alpine | Up |
| aq-postgres | postgres:16-alpine | Up, healthy |
| aq-redis | redis:7-alpine | Up, healthy |
| aq-pubsub / aq-bigtable | cloud-sdk emulators | Up |

## Toolchain

| Tool | Version | Source |
|---|---|---|
| Java | OpenJDK 21.0.8 | local |
| Maven | 3.9.9 | local |
| Node / npm | v22.18.0 / 10.9.3 | local |
| Docker | 28.1.1 | local |
| Trivy | 0.69.3 | local |
| Semgrep | installed (pip) | local |
| psql client | 14.17 | local |
| gitleaks | via docker image | docker |
| k6 | grafana/k6:0.54.0 | docker (same as perf.yml) |
| OWASP ZAP | zaproxy/zap-stable | docker |

## Dataset scale (the "millions of records" context)

Exact counts (`docker exec aq-postgres psql -U aquashield -d aquashield`):

```text
ingestion.sensor_messages   4,010,274 rows
ingestion.sensor_readings   4,010,164 rows
ingestion.energy_hourly_readings 7,939
audit.audit_events 4,988 · pond.feed_logs 3,831 · notification.alert_log 825
```

All k6 load/stress figures in Phase 6 run against this ~8M-row dataset.

## Gateway + auth smoke

- `http://localhost:8080/healthz` → 404 (not a local nginx route; service
  health is proven by compose healthchecks above).
- Admin login through the gateway:

```text
POST http://localhost:8080/api/auth/login (admin@aquashield.local)
→ 200, response keys: token, refreshToken, user, projects
```

## Verdict

| Check | Result |
|---|---|
| 14 containers up, app services healthy | Pass |
| Toolchain present (local + docker images) | Pass |
| Million-record dataset confirmed (~4.01M x2) | Pass |
| Gateway login smoke | Pass |
