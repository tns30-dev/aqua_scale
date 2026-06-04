# Security Tracker — Claude

Last updated: 2026-06-04
Legend: ⬜ not started · 🟨 in progress · ✅ done (evidence linked) · ⛔ blocked

## Summary for Codex

- **Current focus:** Core authn/authz implemented & tested in identity-access-service. Remaining for the workflow item: shared snapshot-consumer middleware in `common/` (for other services) + Identity gRPC fallback.
- **Last completed (2026-06-04):** JWT (RS256, compact claims w/ authzVersion) · refresh rotation with family reuse-detection (replayed token kills family — TESTED) · jti revocation on logout (works BEFORE token expiry; monolith's blacklist was a verified no-op) · Redis authz snapshot build/version/invalidate (access change bumps version, old snapshot deleted — TESTED) · login rate limiting (429 — TESTED). Parity divergences are documented in code.
- **Blockers / questions:** Istio mTLS/AuthorizationPolicy evidence depends on Codex's mesh setup (cloud foundation scope) — will coordinate.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Authn/Authz workflow (JWT + Redis snapshot + refresh + revocation + ACL) | ✅ | PROVEN END-TO-END: Identity mints RS256 JWT + builds snapshot; project-service (first consumer) verifies JWT with PUBLIC key only + authorizes from snapshot, FAIL-CLOSED on missing snapshot (IT t02) — zero Identity calls on hot path. Cross-service smoke green (login→grant→member access→non-member 404). gRPC fallback live | `docs/evidence/project-service/2026-06-04-tests-and-cross-service-smoke.txt` | 2026-06-04 |
| Identity authorization snapshot (feature access + ACL in Redis post-login) | ✅ | Built on login (`authz:snapshot:{userId}:{version}` + `authz:version`), TTL'd, version-bumped + old deleted on access/role change; IT-tested + live keys verified | same file (Redis key listing) | 2026-06-04 |
| Token lifecycle (login, refresh rotation, logout, revocation, MFA-optional) | ✅ | Login/refresh-rotation/reuse-detection/logout/jti-revocation done + tested. MFA = optional state, deferred by design | same file | 2026-06-04 |
| Three-layer firewall model (internet→web→app→data) | ⬜ | — | — | — |
| Service-to-service protection (SA identity, Istio mTLS, AuthorizationPolicy) | ⬜ | — | — | — |
| Security evidence (SAST, SCA, secret scan, container scan, DAST reports) | ⬜ | — | — | — |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Tracker initialized. Specs read (`authn_authz.md`, `network_security.md`, `service_discovery.md`, `identity_and_access_service.md`). |
| 2026-06-04 | Authn/authz core landed with identity service: snapshot ✅, token lifecycle ✅, workflow 🟨 (shared middleware + gRPC fallback pending). |
| 2026-06-04 | Authn/Authz workflow item ✅ — designed hot path proven across two services (cross-service smoke). |
