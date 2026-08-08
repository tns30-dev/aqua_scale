# Phase 4 — CD Rehearsal + Post-Deploy Smoke (2026-08-09)

Local stand-in for the Argo CD sync: deploy a freshly built image by recreating
its container, wait for health, then run the post-deploy smoke — the same
sequence the remote pipeline uses after Argo reports healthy.

## Deploy the remediated image (ties Phase 7 → CD)

The Phase 7 fix produced `analytics-service:...-fix` (0 CRITICAL). It was
retagged to the compose image and rolled out:

```text
docker tag analytics-service:6fbd5a1c8557-fix aquashield-local-analytics-service:latest
docker compose up -d --force-recreate --no-deps analytics-service
→ Container aq-analytics Recreated / Started
```

**Realistic CD catch:** the first recreate went `unhealthy` — the app logged
`JWT_PUBLIC_KEY_PEM is required`. Cause: recreating via raw `docker compose`
bypassed `scripts/up.sh`, which exports the dev JWT PEM keys into the
environment. Re-running with the keys exported (as the real deploy path does)
brought it healthy:

```text
export JWT_PUBLIC_KEY_PEM="$(cat local/dev-keys/jwt-public.pem)"
export JWT_PRIVATE_KEY_PEM="$(cat local/dev-keys/jwt-private.pem)"
docker compose up -d --force-recreate --no-deps analytics-service
→ healthy at attempt 3  (image: aquashield-local-analytics-service, the fixed build)
```

This is exactly the class of config/secret-injection gap a post-deploy smoke is
meant to catch — surfaced and resolved locally before the cloud round.

## Post-deploy smoke (gateway `:8080`, admin session)

```text
GET  /api/csrf                       -> 200
POST /api/auth/login                 -> 200   (token + projects returned)
GET  /api/auth/me                    -> 200   (identity)
GET  /api/projects                   -> 200   (project)
GET  /api/ponds?projectId=<pid>      -> 200   (pond)
GET  /api/alerts?projectId=<pid>     -> 200   (notification)
GET  /api/audit/events?projectId=<pid> -> 200 (audit)
GET  /api/projects/<pid>/summary     -> 200   (project aggregate)
POST /ws/token                       -> 200   (realtime gateway)
```

Every hop of the cross-service authenticated path returns 200: the JWT minted by
identity is accepted by project, pond, notification, audit, analytics, and the
realtime gateway. Full endpoint correctness under proper query params (charts,
pond-comparison, latest-readings, feeding, energy) is separately proven by the
Phase 6 busy-day k6 run — 5,362 checks, 100% pass.

> Note: an initial ad-hoc smoke hit `/api/ponds`, `/api/audit`, and
> `/api/projects/<id>/charts/` without their required query params and saw 400/404;
> re-issuing with the correct params (`?projectId=`, `/audit/events`, chart type)
> returns 200. The 400s were the smoke's param shape, not the deployment.

## Phase verdict

| Check | Result |
|---|---|
| Rolling recreate from freshly built (remediated) image | PASS |
| Config-gap caught + resolved via smoke | PASS (realistic CD scenario) |
| Cross-service authenticated smoke (7 services + ws) | PASS (all 200) |
| Endpoint correctness under load | PASS (Phase 6, 100%) |
