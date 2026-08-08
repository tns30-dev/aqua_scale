# Phase 5 — DAST: OWASP ZAP vs Local Gateway (2026-08-09)

Tool: **OWASP ZAP** (`zaproxy/zap-stable`, `zap-baseline.py`). Target: the local
nginx gateway `http://localhost:8080` (the cloud-edge stand-in), reached from
the ZAP container as `http://host.docker.internal:8080`. Two passes:
unauthenticated and authenticated (admin JWT injected). This is the local
rehearsal; the final DAST evidence runs against `https://api.aquashield.live`
in the remote round.

## Pass 1 — Unauthenticated baseline

```text
zap-baseline.py -t http://host.docker.internal:8080
FAIL-NEW: 0   WARN-NEW: 5   PASS: 62
```

Alerts (all WARN, all on gateway 404 responses):

| Alert | Risk |
|---|---|
| Content Security Policy (CSP) Header Not Set | Low |
| Permissions Policy Header Not Set | Low |
| Server Leaks Version Information (`Server` header) | Low |
| Storable and Cacheable Content | Info |

## Pass 2 — Authenticated (admin JWT via ZAP replacer)

A real admin token was minted through the gateway login and injected as an
`Authorization: Bearer` header on every ZAP request, so protected routes were
exercised as 200s, not 401s:

```text
Token minted: POST /api/auth/login (admin@aquashield.local) → 654-char JWT
Auth proof:   GET /api/projects  WITHOUT token → 401 ; WITH token → 200
Endpoints reached 200: /api/projects, /api/users, /api/alerts (also /api/audit,
  /api/iot-devices, /api/sensor-types, /api/feed-types seeded)

zap-baseline.py -t .../api/projects  -z "<replacer Authorization: Bearer …>"
FAIL-NEW: 0   WARN-NEW: 6   PASS: 61
Spider confirmed: http://host.docker.internal:8080/api/projects (200 OK)
```

Additional alert seen on the authenticated 200 response:

| Alert | Risk | Note |
|---|---|---|
| Cross-Origin-Resource-Policy Header Missing | Low | on `/api/projects` 200 |
| CSP / Permissions-Policy / Non-Storable Content | Low/Info | API JSON responses |

## Assessment

- **No FAIL-level (medium/high) findings in either pass** — the auth boundary
  holds (401 without token), and no injection/exposure alerts fired.
- All findings are **missing security-response-headers** on API/gateway
  responses — a real but low-risk hardening item. These map cleanly onto the
  Phase 7 resolution step: add CSP, Permissions-Policy, Cross-Origin-Resource-
  Policy, and suppress the nginx `Server` version at the gateway, then rescan.
- Note: `zap-baseline` spiders HTML links; a JSON API exposes few crawlable
  links, so coverage here is the seeded endpoint set. The remote round uses the
  OpenAPI-driven `zap-api-scan.py` against the live API for deeper coverage.

## Artifacts

```text
docs/second_evidence/ci_ci/artifacts/
  2026-08-09-zap-baseline-unauth.html / .json
  2026-08-09-zap-baseline-auth.html   / .json
```

## Phase verdict

| Check | Result |
|---|---|
| Unauthenticated ZAP baseline | PASS (0 FAIL, 5 header warnings) |
| Authenticated ZAP pass (JWT-injected, 200 routes) | PASS (0 FAIL, 6 header warnings) |
| Auth boundary (401 without token) | Confirmed |
| Header findings queued for Phase 7 resolution + rescan | Yes |
