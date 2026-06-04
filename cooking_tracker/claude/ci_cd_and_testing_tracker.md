# CI/CD And Testing Tracker - Claude Historical

Last updated: 2026-06-05
Legend: ⬜ not started · 🟨 in progress · ✅ done (evidence linked) · ⛔ blocked

## Summary for Codex

- **Ownership status:** Historical only. Active ownership for all CI/CD And Testing rows moved to [Codex CI/CD tracker](../codex/ci_cd_and_testing_tracker.md) on 2026-06-05.
- **Current focus:** Backend CI proven (path-aware both directions) AND a dedicated FRONTEND pipeline now exists: frontend-ci-cd.yml (Node 22, npm ci → lint → vitest → vite build w/ VITE_API_BASE_URL/VITE_WS_BASE_URL) → Firebase Hosting PREVIEW channel per PR + STAGING channel on main push; LIVE only via manual dispatch (safe default). Deploy jobs SKIP CLEANLY until secrets.FIREBASE_SERVICE_ACCOUNT + vars.FIREBASE_PROJECT_ID are configured (documented in the workflow header). firebase.json added (SPA rewrite + cdn.md cache policy). Also: CI's container matrix caught the multi-module Dockerfile bug (root pom w/ 7 modules vs partial COPY) → all Dockerfiles fixed to full-reactor COPY + .dockerignore.
- **Last completed (2026-06-04):** CI grew its first NON-JAVA lane: `analytics-verify` (Node 22, npm ci → tsc build → 49 vitest → `npm audit --omit=dev --audit-level=high`) + `analytics-container` (docker build from repo root + Trivy image scan), path-filtered on `analytics-service/**` AND `shared-api/src/main/proto/**` (proto changes fan out to the TS consumer). ALSO FIXED: `pond-service` was missing from the java path filters + SERVICES matrix since its ship — pond commits would have skipped CI; now included. Test pyramid: every Java service ships Testcontainers ITs; reactor green at 101 tests + 49 vitest.
- **Blockers / questions:** Artifact Registry push, GitOps manifest update, and Argo CD rollout were transferred to Codex on 2026-06-05. Remaining rows here are smoke/DAST/JMeter/demo-evidence testing work.

## Transferred To Codex

| Item | New tracker | Notes | Updated |
|---|---|---|---|
| Path-aware CI workflows | [Codex CI/CD tracker](../codex/ci_cd_and_testing_tracker.md) | Implemented and proven; Codex owns ongoing CI/CD evidence. | 2026-06-05 |
| Artifact Registry push (versioned, Git-SHA tagged) | [Codex CI/CD tracker](../codex/ci_cd_and_testing_tracker.md) | Integrates after Artifact Registry and GitHub OIDC/WIF are available. | 2026-06-05 |
| GitOps manifest update (Kustomize image tag) | [Codex CI/CD tracker](../codex/ci_cd_and_testing_tracker.md) | Needs deploy handoff workflow and final GitOps path/repo decision. | 2026-06-05 |
| Argo CD rollout (sync + health evidence) | [Codex CI/CD tracker](../codex/ci_cd_and_testing_tracker.md) | Needs live cluster, Argo CD install, and Application health evidence. | 2026-06-05 |
| Smoke tests | [Codex CI/CD tracker](../codex/ci_cd_and_testing_tracker.md) | Local e2e exists; cloud post-deploy smoke pending. | 2026-06-05 |
| DAST | [Codex CI/CD tracker](../codex/ci_cd_and_testing_tracker.md) | Pending deployed endpoint. | 2026-06-05 |
| JMeter load + stress tests | [Codex CI/CD tracker](../codex/ci_cd_and_testing_tracker.md) | Perf lane exists; plans/evidence pending. | 2026-06-05 |
| Demo evidence | [Codex CI/CD tracker](../codex/ci_cd_and_testing_tracker.md) | Local evidence exists; cloud evidence pending. | 2026-06-05 |

## Historical Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Path-aware CI workflows (changed-service matrix) | ✅ | PROVEN ON GITHUB both directions: root-pom commit → all 6 services fanned out (Testcontainers ITs green on runners); workflow-only commit → zero services selected (java-verify/container skipped), all security gates green, run SUCCESS. perf.yml JMeter lane wired (plans pending). PENDING items split: deploy-handoff (needs registry+OIDC), SHA-pinning, HIGH ratchet | `docs/evidence/ci/2026-06-04-ci-skeleton-and-dependency-hardening.txt` + Actions runs | 2026-06-04 |
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
| 2026-06-04 | First GitHub runs: run2 SUCCESS with path-awareness proven both ways (fan-out + skip). Trivy action ref fixed (v0.36.0). Path-aware CI item → ✅. |
| 2026-06-04 | frontend-ci-cd.yml shipped: path-isolated React/Vite pipeline → Firebase preview (PR) / staging (main) / live (manual only); secrets-safe skips; local validation 100 vitest + clean build. Dockerfile multi-module fix (caught by CI container matrix) pushed separately as 62d8383. Required GitHub config documented for the user: FIREBASE_SERVICE_ACCOUNT secret + FIREBASE_PROJECT_ID/VITE_API_BASE_URL/VITE_WS_BASE_URL vars. |
| 2026-06-04 | analytics lanes added to ci.yml (TS verify + container scan; proto-aware path filter) and pond-service path-filter gap FIXED (was silently skipping pond CI since its ship). ci-summary extended with the new lanes. Local validation: 49/49 vitest, tsc clean, docker build OK, npm audit (prod) 0 vulns. |
| 2026-06-04 | audit-service added to CI filters + matrix at ship time (pond lesson institutionalized). Local verify gotcha documented in evidence: `mvn -pl <svc> verify` WITHOUT `-am` fails resolution against stale reports, and `cmd \| grep` masks mvn's exit code — two false "greens" caught; real run = `-pl <svc> -am` + pipefail or full-log capture. 109 Java + 49 TS green locally. |
| 2026-06-04 | xsvc-readings ship: oracle methodology hardened — expectations cross-checked against LIVE CPython runs (float-exact, not decimal-ideal) before writing assertions; PyRound unit oracles pin the rounding boundary in common. Reactor `mvn clean verify` 114 Java + analytics 49 vitest = 163 green. Proto change fans out to all java services + analytics lanes in CI. CI run 26954948827 fully green (8 java verifies + both analytics lanes + 8 containers + gates). |
| 2026-06-04 | Local e2e harness shipped (docs/LOCAL_E2E.md): the manual smoke layer of the test pyramid is now scripted+repeatable — compose gateway + run-services + seed-demo prove the full user journey (auth→data→charts→alerts→websocket) against real services before any cloud deploy. Doubles as the smoke-test design for post-deploy CD checks. |
| 2026-06-05 | Ownership handover expanded: all CI/CD And Testing rows moved to Codex CI/CD tracker. |
