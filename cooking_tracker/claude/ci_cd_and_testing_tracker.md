# CI/CD And Testing Tracker — Claude

Last updated: 2026-06-04
Legend: ⬜ not started · 🟨 in progress · ✅ done (evidence linked) · ⛔ blocked

## Summary for Codex

- **Current focus:** CI SKELETON SHIPPED (ci.yml + perf.yml) and dependency hardening done off the back of the first scan (Boot 3.4.5→3.5.14 + tomcat 10.1.55 pin → ZERO CRITICAL CVEs, 84 tests still green). Next: verify first GitHub runs, then deploy-handoff.yml when Codex's registry+OIDC exist.
- **Last completed:** Test pyramid built service-by-service: every service ships Testcontainers ITs (Postgres / Redis / Pub/Sub emulator / in-process gRPC fakes); `mvn clean verify` green across the reactor (79 tests). Demo-evidence capture ongoing per service in `docs/evidence/`.
- **Blockers / questions:** Artifact Registry + Argo CD install are Codex cloud-foundation scope — CI image push & GitOps handoff integrate once ready. OIDC/WIF setup needed before any cloud-touching CI step (user provides GCP access).

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Path-aware CI workflows (changed-service matrix) | 🟨 | ci.yml live: detect-changes → changed-service Maven verify matrix (Testcontainers) → Gitleaks/Semgrep/Trivy/CycloneDX gates → container build+scan matrix → summary. Shared modules fan out to all services. First runs pending verification on GitHub. perf.yml JMeter lane wired (plans pending). PENDING: deploy-handoff (registry+OIDC), SHA-pinning, HIGH ratchet | `.github/workflows/` + `docs/evidence/ci/` | 2026-06-04 |
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
| 2026-06-04 | CI skeleton shipped: path-aware ci.yml (matrix verify + 4 security gates + container scan + SBOM) + perf.yml JMeter lane + .gitleaks.toml. Local dry-runs: Trivy found REAL tomcat/spring-security CRITICALs → fixed via Boot 3.5.14 + tomcat 10.1.55 dependencyManagement pin → 0 CRITICALs, Semgrep clean, 84 tests green. |
