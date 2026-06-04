# Services Tracker — Claude

Last updated: 2026-06-04
Legend: ⬜ not started · 🟨 in progress · ✅ done (evidence linked) · ⛔ blocked

## Summary for Codex

- **Current focus:** Identity & Access Service core is BUILT and TESTED (31 tests green + live smoke vs compose). Next: identity gRPC contracts (`shared-api/proto/`) + audit event publishing, or start project-service — user directs.
- **Last completed (2026-06-04):** identity-access-service: Maven module, Flyway schema (parity port of module_user minus dead `roles` table), RBAC service with exact monolith semantics (incl. the intentional global action-wildcard leak), RS256 JWT (compact claims: sub/jti/role/authzVersion), opaque rotating refresh tokens w/ family reuse-detection, Redis authz snapshot build/version/invalidate, jti revocation, login rate limiting, admin user mgmt (onboard defaults hydration, access diff-sync), parity error envelopes. Monolith parity spec extracted first (agent) and used as test oracles.
- **Blockers / questions:** None. NOTE for everyone: host ports — monolith's local postgres/redis own 5432/6379, compose stack now maps **5433 (pg) / 6380 (redis)**.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Identity and Access Service (Java) | 🟨 | Core DONE: REST auth (login/refresh/logout/me) + admin user mgmt, RBAC parity, Redis snapshot, refresh rotation+reuse detection, jti revocation, rate limit. 31 tests green (13 RBAC oracles, 6 validator, 12 IT w/ Testcontainers) + live smoke vs compose. PENDING: gRPC contracts, audit event publishing, image build, k8s manifests | `docs/evidence/identity-access/2026-06-04-test-and-smoke.txt` | 2026-06-04 |
| Project Service (Java) | ⬜ | — | — | — |
| Pond Service (Java) | ⬜ | — | — | — |
| Sensor Service (Java) | ⬜ | — | — | — |
| Ingestion Service (Java, Pub/Sub consumer) | ⬜ | — | — | — |
| Notification Service (Java) | ⬜ | — | — | — |
| Realtime Gateway (Java WebFlux, WSS) | ⬜ | — | — | — |
| Analytics Service (TypeScript/Express) | ⬜ | — | — | — |
| Audit Service (Java, append-only) | ⬜ | — | — | — |
| ML placeholder (Python/FastAPI, folder+docs only) | ⬜ | — | — | — |
| LLM placeholder (Python/FastAPI, folder+docs only) | ⬜ | — | — | — |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Tracker initialized. Claude `.claude` skillset rebuilt for GCP/Java/Kustomize/ArgoCD stack per `main/` specs. No service code yet. |
| 2026-06-04 | Clean repo `aquashield/` created with full monorepo layout; local compose foundation verified (postgres/redis/pubsub/bigtable). Service development unblocked — no service code yet. |
| 2026-06-04 | RESTRUCTURE (user decision): single repo `tns30-dev/aqua_scale`; `aquashield/` layer dissolved. Flat ChronoFlow-style layout — one service folder per repo root + `common/` + `shared-api/{proto,events}` + `k8s/` + `infra/` + `jmeter/`; root `pom.xml` Maven multi-module parent (Java 21, Boot 3.4.x). CI path filters/Argo paths now `<service>/**` and `k8s/overlays/...` — Codex notified to update `main/ci.md`, `main/cd.md`, `main/pub_sub_contract_docs.md` paths. |
| 2026-06-04 | identity-access-service core implemented: parity-spec-driven (agent analysis of module_user), 31 tests green (incl. Testcontainers ITs for rotation/reuse/revocation/snapshot), live smoke vs compose. Compose host ports remapped pg→5433, redis→6380 (monolith owns 5432/6379). Commit pending push. |
