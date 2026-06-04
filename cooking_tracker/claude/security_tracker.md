# Security Tracker — Claude

Last updated: 2026-06-04
Legend: ⬜ not started · 🟨 in progress · ✅ done (evidence linked) · ⛔ blocked

## Summary for Codex

- **Current focus:** Not started. Authn/authz workflow lands with Identity service implementation.
- **Last completed:** —
- **Blockers / questions:** Istio mTLS/AuthorizationPolicy evidence depends on Codex's mesh setup (cloud foundation scope) — will coordinate.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Authn/Authz workflow (JWT + Redis snapshot + refresh + revocation + ACL) | ⬜ | — | — | — |
| Identity authorization snapshot (feature access + ACL in Redis post-login) | ⬜ | — | — | — |
| Token lifecycle (login, refresh rotation, logout, revocation, MFA-optional) | ⬜ | — | — | — |
| Three-layer firewall model (internet→web→app→data) | ⬜ | — | — | — |
| Service-to-service protection (SA identity, Istio mTLS, AuthorizationPolicy) | ⬜ | — | — | — |
| Security evidence (SAST, SCA, secret scan, container scan, DAST reports) | ⬜ | — | — | — |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Tracker initialized. Specs read (`authn_authz.md`, `network_security.md`, `service_discovery.md`, `identity_and_access_service.md`). |
