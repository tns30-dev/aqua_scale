# Services Tracker — Claude

Last updated: 2026-06-04
Legend: ⬜ not started · 🟨 in progress · ✅ done (evidence linked) · ⛔ blocked

## Summary for Codex

- **Current focus:** TWO services live (identity + project), 49 tests green, cross-service auth flow PROVEN (9-step smoke). Next candidates: sensor-service (unblocks ingestion), audit event publishing, or CI skeleton — user directs.
- **New shared modules (2026-06-04):** `shared-api` (gRPC protos; `identity.proto` v1 with the 5 spec RPCs) and `common` (canonical authz contract: FeatureActionEntry + AccessEvaluator + AuthzSnapshot + fail-closed AuthzSnapshotConsumer, JwtVerifier for RS256 public-key validation, EventEnvelope). Resource services consume these — semantics can't drift. NOTE: net.devh grpc starter is INCOMPATIBLE with Boot 3.4/Security 6.4 — we run plain grpc-java via a SmartLifecycle (`grpc.server.port`, `grpc.server.in-process-name`); also pinned protobuf-java 4.29.3 in parent dependencyManagement (spring-cloud-gcp BOM downgrades it → gencode/runtime clash).
- **Last completed (2026-06-04):** identity-access-service: Maven module, Flyway schema (parity port of module_user minus dead `roles` table), RBAC service with exact monolith semantics (incl. the intentional global action-wildcard leak), RS256 JWT (compact claims: sub/jti/role/authzVersion), opaque rotating refresh tokens w/ family reuse-detection, Redis authz snapshot build/version/invalidate, jti revocation, login rate limiting, admin user mgmt (onboard defaults hydration, access diff-sync), parity error envelopes. Monolith parity spec extracted first (agent) and used as test oracles.
- **Blockers / questions:** None. NOTE for everyone: host ports — monolith's local postgres/redis own 5432/6379, compose stack now maps **5433 (pg) / 6380 (redis)**.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Identity and Access Service (Java) | 🟨 | Core + gRPC DONE: REST auth + admin mgmt, RBAC parity, Redis snapshot, refresh rotation+reuse detection, jti revocation, rate limit, and the 5 spec gRPC RPCs (in-process IT-tested). 32 tests green + live smoke. PENDING: audit event publishing, image build, k8s manifests | `docs/evidence/identity-access/` (2 files) | 2026-06-04 |
| Project Service (Java) | 🟨 | Core DONE: parity REST (profile-types/parameters/growth catalogues, projects list/detail/all with per-endpoint casing, parameter-settings, energy merge-upsert + dashboard shape), snapshot-based authz (FIRST consumer of common JwtVerifier+AuthzSnapshotConsumer, fail-closed tested), Redis caches w/ invalidation, Pub/Sub events (emulator-tested), 5 gRPC RPCs. 17 tests + CROSS-SERVICE SMOKE with identity (9-step flow green). PENDING: energy dashboard real telemetry (needs Ingestion/Bigtable), image build, k8s manifests | `docs/evidence/project-service/` | 2026-06-04 |
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
| 2026-06-04 | shared-api (identity.proto v1) + common (canonical authz contract, JwtVerifier, EventEnvelope) modules added; identity gRPC server live (plain grpc-java SmartLifecycle — net.devh incompatible w/ Boot 3.4). 32 tests green. protobuf-java pinned 4.29.3 (GCP BOM downgrade clash). |
| 2026-06-04 | project-service shipped: parity-spec-driven (module_project agent analysis), 17 tests + 9-step CROSS-SERVICE smoke with identity (JWT public-key verification + fail-closed snapshot authz proven). Pub/Sub events live on emulator. Found+fixed Maven scope-mediation packaging bug (test-scoped jjwt-impl stripped parser from boot jar). pubsub-bootstrap.sh idempotent + project.* topics added — Codex: please add project.created/updated/settings.updated to main/pub_sub_contract_docs.md. |
