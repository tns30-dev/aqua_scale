# Security Tracker — Claude

Last updated: 2026-06-04
Legend: ⬜ not started · 🟨 in progress · ✅ done (evidence linked) · ⛔ blocked

## Summary for Codex

- **Current focus:** Application-layer security DONE incl. the WebSocket model (one-time WS tokens, ws:jti replay rejection, fail-closed snapshot at mint, origin allow-list, auth timeout, project-scoped delivery — all IT-tested in realtime-gateway). Next: CI security gates (SAST/SCA/secrets/SBOM/container scan — lands with the CI skeleton), then firewall/mTLS evidence with Codex's cloud foundation.
- **Last completed (2026-06-04):** SECURITY AUDIT TRAIL is live: identity publishes login.succeeded/login.failed (reason codes invalid_credentials/rate_limited; attributable actor on known-account failures; NEVER credential material — IT-asserted) → audit-service persists to a DB-trigger-enforced append-only table (UPDATE/DELETE raise even for the owner — IT-proven) with an admin-only review API incl. `/api/audit/security`. The generic-401 parity is preserved at the HTTP layer while the audit trail records the real reason — no information leakage to clients, full visibility for admins. Previous: TS auth port in analytics; auth model in all Java REST services; IoT PayloadHmac chain.
- **Blockers / questions:** Istio mTLS/AuthorizationPolicy evidence depends on Codex's mesh setup (cloud foundation scope) — will coordinate.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Authn/Authz workflow (JWT + Redis snapshot + refresh + revocation + ACL) | ✅ | PROVEN END-TO-END: Identity mints RS256 JWT + builds snapshot; project-service (first consumer) verifies JWT with PUBLIC key only + authorizes from snapshot, FAIL-CLOSED on missing snapshot (IT t02) — zero Identity calls on hot path. Cross-service smoke green (login→grant→member access→non-member 404). gRPC fallback live | `docs/evidence/project-service/2026-06-04-tests-and-cross-service-smoke.txt` | 2026-06-04 |
| Identity authorization snapshot (feature access + ACL in Redis post-login) | ✅ | Built on login (`authz:snapshot:{userId}:{version}` + `authz:version`), TTL'd, version-bumped + old deleted on access/role change; IT-tested + live keys verified | same file (Redis key listing) | 2026-06-04 |
| Token lifecycle (login, refresh rotation, logout, revocation, MFA-optional) | ✅ | Login/refresh-rotation/reuse-detection/logout/jti-revocation done + tested. MFA = optional state, deferred by design | same file | 2026-06-04 |
| Three-layer firewall model (internet→web→app→data) | ⬜ | — | — | — |
| Service-to-service protection (SA identity, Istio mTLS, AuthorizationPolicy) | ⬜ | — | — | — |
| Security evidence (SAST, SCA, secret scan, container scan, DAST reports) | 🟨 | CI gates wired (Gitleaks, Semgrep p/java+security-audit, Trivy fs CRITICAL gate + HIGH report, Trivy image scan, CycloneDX SBOM artifacts). FIRST CATCH already evidenced: tomcat/spring-security CRITICAL CVEs found by the local dry-run → dependency hardening (Boot 3.5.14 + tomcat 10.1.55) → 0 CRITICALs. DAST pending deployment | `docs/evidence/ci/2026-06-04-ci-skeleton-and-dependency-hardening.txt` | 2026-06-04 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Tracker initialized. Specs read (`authn_authz.md`, `network_security.md`, `service_discovery.md`, `identity_and_access_service.md`). |
| 2026-06-04 | Authn/authz core landed with identity service: snapshot ✅, token lifecycle ✅, workflow 🟨 (shared middleware + gRPC fallback pending). |
| 2026-06-04 | Authn/Authz workflow item ✅ — designed hot path proven across two services (cross-service smoke). |
| 2026-06-04 | Refresh: auth model consumed by all REST services; IoT HMAC chain (cross-language vectors, device-key handling, skew, reject discipline) live in sensor+ingestion. CI security gates next. |
| 2026-06-04 | WebSocket security model live + tested (realtime-gateway): one-time token consume, replay AUTH_FAILED, fail-closed mint, origin check, auth timeout, scoped fanout. |
| 2026-06-04 | CI security gates live + first real catch (tomcat CVE-2026-41293/43512/43515, spring-security CVE-2025-41232) remediated via dependency hardening. |
| 2026-06-04 | Auth model crosses the language boundary: TS port (jose + ioredis) in analytics-service, fail-closed semantics pinned by vitest; npm audit gate + Trivy image scan added for the Node lane. Chart endpoint enforces snapshot project scope (out-of-scope → 404 parity envelope). |
| 2026-06-04 | Security audit trail live end-to-end: identity login.succeeded/failed audit payloads → audit-service append-only store (DB trigger immutability) → admin-only `/api/audit/security` review. Client-facing generic 401 unchanged; reasons live only in the trail. Follow-up: richer audit payloads from project/pond/sensor/notification writes (their business events already derive into the trail). |
| 2026-06-04 | xsvc-readings ship — no new security surface: readings flow over the existing in-cluster gRPC seam (mesh mTLS target); consumers stay fail-soft (readings errors → empty payloads, never 5xx/leaks); membership checks on comparison/energy endpoints unchanged. |
