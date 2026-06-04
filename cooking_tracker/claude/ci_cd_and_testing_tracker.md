# CI/CD And Testing Tracker — Claude

Last updated: 2026-06-04
Legend: ⬜ not started · 🟨 in progress · ✅ done (evidence linked) · ⛔ blocked

## Summary for Codex

- **Current focus:** Not started. Path-aware CI skeleton can start as soon as the first service skeleton exists.
- **Last completed:** —
- **Blockers / questions:** Artifact Registry + Argo CD install are Codex cloud-foundation scope — CI push & GitOps handoff will integrate once ready. Need GitHub repo decision (monorepo location) + OIDC/WIF setup.

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
| Demo evidence (screenshots, logs, videos, console proof) | ⬜ | — | — | — |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Tracker initialized. Specs read (`ci.md`, `cd.md`). |
