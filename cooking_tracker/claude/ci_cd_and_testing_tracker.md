# CI/CD And Testing Tracker — Claude

Last updated: 2026-06-04
Legend: ⬜ not started · 🟨 in progress · ✅ done (evidence linked) · ⛔ blocked

## Summary for Codex

- **Current focus:** CI workflows not started YET — but preconditions are now rich: 5 services + 2 shared modules, 79 tests (unit + Testcontainers ITs), per-service Dockerfiles, monorepo decided (`tns30-dev/aqua_scale`). Path-aware CI skeleton is the natural next step and needs no cloud access.
- **Last completed:** Test pyramid built service-by-service: every service ships Testcontainers ITs (Postgres / Redis / Pub/Sub emulator / in-process gRPC fakes); `mvn clean verify` green across the reactor (79 tests). Demo-evidence capture ongoing per service in `docs/evidence/`.
- **Blockers / questions:** Artifact Registry + Argo CD install are Codex cloud-foundation scope — CI image push & GitOps handoff integrate once ready. OIDC/WIF setup needed before any cloud-touching CI step (user provides GCP access).

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Path-aware CI workflows (changed-service matrix) | ⬜ | — | — | — |
| Artifact Registry push (versioned, Git-SHA tagged) | ⬜ | — | — | — |
| GitOps manifest update (Kustomize image tag) | ⬜ | — | — | — |
| Argo CD rollout (sync + health evidence) | ⬜ | — | — | — |
| Smoke tests (post-deploy health/contract checks) | ⬜ | — | — | — |
| DAST (OWASP ZAP post-deploy) | ⬜ | — | — | — |
| JMeter load + stress tests (`performance-test` branch only) | ⬜ | — | — | — |
| Demo evidence (screenshots, logs, videos, console proof) | 🟨 | Per-service evidence accumulating: test+smoke transcripts, live Redis key listings, 9-step cross-service smoke (identity→project), decoded JWT claims | `docs/evidence/{identity-access,project-service,sensor-service,ingestion-service,notification-service,local-foundation}/` | 2026-06-04 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Tracker initialized. Specs read (`ci.md`, `cd.md`). |
| 2026-06-04 | Refresh: 5 services + 79 reactor tests; per-service Dockerfiles ready; repo decided — CI skeleton unblocked. Demo-evidence item → 🟨 (6 evidence folders). |
