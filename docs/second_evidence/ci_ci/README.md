# Local CI/CD Evidence Index (2026-08-09)

Local DevSecOps rehearsal against the Docker Compose stack (9 services + nginx
gateway, ~8M-row Postgres). Plan: `local.md`. Owner: Claude (CI/CD duty);
Codex owns cloud deployment (DNS/Istio/data) in parallel. The remote round
re-runs this against `https://api.aquashield.live` once the cloud is stable.

## Phase evidence

| Phase | Rubric area | File | Verdict |
|---|---|---|---|
| 0 Preflight | environment proof | `2026-08-09-phase0-preflight.md` | PASS |
| 1 Build + tests | unit + integration artifacts | `2026-08-09-phase1-build-and-tests.md` | PASS (Java 127; analytics 50) · frontend tests flagged |
| 2 Security gates | SAST + SCA + secrets + SBOM | `2026-08-09-phase2-security-gates.md` | PASS |
| 3 Container mgmt | build/save, image scan, inspect, logs | `2026-08-09-phase3-container-management.md` | PASS (8/9) · analytics CRITICAL → P7 |
| 4 CD rehearsal | deploy + post-deploy smoke | `2026-08-09-phase4-cd-rehearsal-smoke.md` | PASS |
| 5 DAST | OWASP ZAP | `2026-08-09-phase5-dast-zap.md` | PASS (0 FAIL) |
| 6 Load + stress | load/stress/growth/websocket | `../performance/2026-08-09-local-k6-load-stress.md` | PASS |
| 7 Resolution + rescan | fix + rescan | `2026-08-09-phase7-vuln-resolution-rescan.md` | PASS (CRITICAL fixed) |
| 8 Compliance-as-code | IaC + git audit + regulatory | `2026-08-09-phase8-compliance-as-code.md` | PASS |

## Raw artifacts (`artifacts/`)

| Artifact | From |
|---|---|
| `2026-08-09-semgrep-report.json` | Semgrep SAST (1 warning) |
| `2026-08-09-gitleaks-report.json` | Gitleaks (0 leaks) |
| `2026-08-09-trivy-fs-summary.json` | Trivy fs (0 CRITICAL; 309 HIGH / 368 MED) |
| `2026-08-09-cyclonedx-sbom.json` | CycloneDX aggregate SBOM (11 modules) |
| `2026-08-09-trivy-image-summary.txt` | 9 image scans (8 PASS, analytics FAIL→fixed) |
| `2026-08-09-trivy-image-analytics-BEFORE/AFTER.json` | tar-CVE fix before/after |
| `2026-08-09-zap-baseline-unauth/auth.html+json` | ZAP DAST (both passes) |
| `loadtests/results/k6-local-2026-08-09-*.json` | k6 load/stress/growth/websocket exports |

## Headline results

- **Tests:** Java 127/127, analytics 50/50. Frontend 10 tests + 1 lint FAIL
  (in-flight LoginPage/TopNav UI, Codex-owned — flagged, not touched).
- **Security gates:** 0 CRITICAL in fs scan, 0 secrets, SBOM generated, SAST 1
  low warning.
- **Containers:** 8/9 images 0-CRITICAL; analytics `tar` CRITICAL fixed →
  rescan CRITICAL=0/HIGH=0.
- **DAST:** 0 FAIL both passes; only low-risk missing-header warnings.
- **Performance (vs 3s target):** load 50 VUs p95 11.5 ms / 0% err; stress knee
  at 500 VUs (connection-layer, 2.5% err); growth heaviest p95 864 ms over 4M
  readings; websocket 50/50 sessions, connect p95 26 ms.

## Code changes made this round (CI/CD scope only)

- `analytics-service/Dockerfile` (+4 lines): remove unused global npm from the
  runtime stage → eliminates the `tar` CRITICAL + 7 HIGH. No Codex-owned files
  (edge/frontend/DNS/Istio/data) touched.

## CI/CD demo video shot-list (max 5 min)

Order for the DevSecOps presentation recording, drawing on this evidence:

1. **Pipeline overview** — `.github/workflows/` (`ci.yml` path-aware matrix,
   `deploy-handoff.yml`, `perf.yml`); one GitHub Actions run showing the
   changed-service fan-out.
2. **Unit + integration** — `mvn verify` 127 green + surefire/failsafe reports;
   analytics 50 vitest (Phase 1).
3. **SAST/SCA/secrets/SBOM** — Semgrep, Trivy fs, gitleaks, CycloneDX artifacts
   (Phase 2).
4. **Container build + image scan** — 9 images, Trivy gate, non-root/inspect/logs
   (Phase 3).
5. **Deploy + smoke** — rolling recreate + cross-service 200 smoke (Phase 4).
6. **DAST** — ZAP HTML report, authenticated pass (Phase 5).
7. **Load + stress** — k6 breaking curve 50→250→500 VUs + websocket (Phase 6).
8. **Vulnerability resolution** — analytics `tar` CRITICAL before→after rescan
   (Phase 7).
9. **Compliance as code** — Terraform/Kustomize validate + git audit trail
   (Phase 8).

## Remote round (blocked on Codex "environment stable")

"Stable" = DNS → `34.54.25.36`, managed TLS ACTIVE, Istio sidecars healthy,
Cloud SQL data presentable, login via `https://www.aquashield.live` CORS-clean.
Then: `ci.yml` + `deploy-handoff.yml` end-to-end (GAR push via OIDC/WIF →
Kustomize bump → Argo CD sync), ZAP DAST + k6 (load/stress/growth/websocket)
vs the deployed API. Open item: **Argo CD is not yet installed** in the new
cluster (Codex confirmed) — recommend installing it before the remote round so
the CD demo shows a real GitOps sync, not only the handoff commit.
