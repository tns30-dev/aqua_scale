# Phase 3 — Container Management (2026-08-09)

Rubric b.i–b.iv: building & saving images, image security, interact/inspect,
container logs. Images built from the current commit `6fbd5a1c8557` (same
`docker build -f <svc>/Dockerfile .` shape as `ci.yml` / `deploy-handoff.yml`).

## Build + tag (b.i)

9 service images built and tagged with the git short-SHA:

| Image | Size |
|---|---|
| identity-access-service:6fbd5a1c8557 | 504 MB |
| project-service | 504 MB |
| pond-service | 504 MB |
| sensor-service | 503 MB |
| notification-service | 503 MB |
| audit-service | 502 MB |
| ingestion-service | 481 MB |
| realtime-gateway | 432 MB |
| analytics-service | 253 MB |

Saving an image (registry-push stand-in for local; remote round pushes to
Artifact Registry):

```text
docker save realtime-gateway:6fbd5a1c8557 -o realtime-gateway-6fbd5a1c8557.tar
→ 137 MB tarball (kept in scratchpad, too large to commit)
```

## Image security — Trivy per image (b.ii)

```text
trivy image --severity CRITICAL,HIGH <svc>:6fbd5a1c8557
```

| Image | CRITICAL | HIGH | CI gate (CRITICAL) |
|---|---|---|---|
| identity-access-service | 0 | 20 | PASS |
| project-service | 0 | 20 | PASS |
| pond-service | 0 | 20 | PASS |
| sensor-service | 0 | 20 | PASS |
| ingestion-service | 0 | 15 | PASS |
| notification-service | 0 | 20 | PASS |
| realtime-gateway | 0 | 27 | PASS |
| audit-service | 0 | 20 | PASS |
| **analytics-service** | **1** | 7 | **FAIL** |

**Finding for Phase 7:** analytics image ships **CVE-2026-59873** —
`tar 7.5.11` (node-tar gzip-bomb DoS), **fix available in 7.5.19**. This is the
kind of finding the CI `container` job's `exit-code: 1` would block on. It is
carried into Phase 7 for resolution + rescan. Java-image HIGHs are JRE/OS base
layers (same across all 8), tracked as the documented HIGH ratchet, not gated.

Artifacts: `artifacts/2026-08-09-trivy-image-summary.txt`,
`artifacts/2026-08-09-trivy-image-analytics-BEFORE.json`.

## Interact + inspect (b.iii)

```text
docker inspect aq-identity:
  User=aquashield  Health=[CMD wget -qO- http://localhost:8081/actuator/health]
  RestartCount=0

docker exec aq-identity id:
  uid=1000(aquashield) gid=101(aquashield)   ← non-root runtime
docker exec aq-identity ps:
  PID 1 = java (app is init, no shell wrapper)
```

`docker stats` snapshot (idle) — all services well within limits:

```text
aq-notification 1.2 GiB   aq-pond 775 MiB   aq-project 700 MiB
aq-identity 658 MiB   aq-audit 618 MiB   aq-postgres 394 MiB
aq-gateway 2.5 MiB   aq-redis 11 MiB      (host 23.4 GiB)
```

## Container logs (b.iv)

```text
docker logs aq-identity:
  Tomcat started on port 8081 · gRPC server listening on 9091 ·
  Started IdentityAccessApplication in 3.885 s
```

Structured Spring Boot startup + request logs are captured; a slow
PubSub-emulator health probe (51 s) is visible as a WARN — emulator quirk, not
an app fault. (Also observed: transient gRPC epoll reconnect noise in
aq-ingestion logs — emulator reconnect, service stays healthy with 0 restarts.)

## Phase verdict

| Check | Result |
|---|---|
| 9 images built + SHA-tagged | PASS |
| docker save (image export) | PASS |
| Image scans — 8/9 gate PASS | PASS |
| analytics image CRITICAL (tar CVE) | FAIL → Phase 7 |
| Non-root user + healthcheck + 0 restarts | PASS |
| Inspect / exec / stats / logs captured | PASS |
