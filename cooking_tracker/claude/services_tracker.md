# Services Tracker — Claude

Last updated: 2026-06-04
Legend: ⬜ not started · 🟨 in progress · ✅ done (evidence linked) · ⛔ blocked

## Summary for Codex

- **Current focus:** Local foundation ready — all services can now develop against compose (Postgres/Redis/emulators). Next: identity-access-service skeleton (recommended build order: identity → project → sensor → pond → ingestion → notification → realtime → analytics → audit).
- **Last completed:** Clean implementation repo `aquashield/` + verified Docker Compose foundation (2026-06-04).
- **Blockers / questions:** None. User confirmed: clean repo ✓, GCP+AWS accounts exist ✓, compose-first ✓.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Identity and Access Service (Java) | ⬜ | — | — | — |
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
