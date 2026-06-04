# CI/CD And Testing Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns CI/CD, GitOps handoff, Argo CD rollout proof, post-deploy smoke tests, DAST, JMeter, and demo evidence.
- Current state: Path-aware CI is proven and already builds/tests/scans/containerizes changed services. Image push and GitOps handoff are intentionally not implemented yet.
- Current test: GitHub Actions CI evidence, local Kustomize render, local e2e harness, and security gate evidence.
- Next test: Add a deploy-handoff workflow after GCP Artifact Registry and GitHub OIDC/WIF are configured, then prove one service image push and one Kustomize tag update.
- Inputs ready from user: GCP account exists. Still need project ID, region, GitHub WIF provider/service account, GitOps branch/path policy, and Argo CD deployment decision.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Path-aware CI workflows | DONE | Proven on GitHub for Java services and analytics lane. Security gates, SBOM, container build/scan, and changed-service matrix exist. | `../../.github/workflows/ci.yml`, `../../docs/evidence/ci/2026-06-04-ci-skeleton-and-dependency-hardening.txt` | 2026-06-04 |
| Artifact Registry push | TODO | CI currently builds and scans service images with Git SHA tags but does not push. Needs Artifact Registry apply and GitHub OIDC/WIF. | `../../.github/workflows/ci.yml`, `../../infra/modules/artifact-registry/` | 2026-06-05 |
| GitOps manifest update | TODO | No deploy handoff workflow is active. Target is a Kustomize image tag update after successful image scan/push. | `../main/ci.md`, `../main/cd.md`, `../../k8s/overlays/dev/`, `../../k8s/overlays/staging/` | 2026-06-05 |
| Argo CD rollout | TODO | Argo CD is selected in docs but not installed/proven against a live cluster. | `../main/cd.md`, `../main/gke.md` | 2026-06-05 |
| Smoke tests | IN_PROGRESS | Local e2e harness exists and maps to post-deploy smoke design. Cloud post-deploy smoke evidence pending. | `../../docs/LOCAL_E2E.md`, `../../docs/evidence/local-e2e/2026-06-04-gateway-e2e.md` | 2026-06-04 |
| DAST | TODO | Requires deployed dev/staging API endpoint. Plan is OWASP ZAP baseline after Argo CD health and smoke pass. | `../main/cd.md` | 2026-06-05 |
| JMeter load and stress tests | TODO | `perf.yml` lane exists; concrete plans/evidence are pending. Should run only on `performance-test` branch or manual dispatch. | `../../.github/workflows/perf.yml`, `../main/ci.md` | 2026-06-05 |
| Demo evidence | IN_PROGRESS | Per-service and local foundation evidence exists; cloud console screenshots/logs/rollout proof pending. | `../../docs/evidence/` | 2026-06-04 |

## Validation

| Check | Result | Updated |
|---|---|---|
| Path-aware CI | PASS in GitHub evidence. | 2026-06-04 |
| Local e2e harness | PASS in existing local evidence. | 2026-06-04 |
| Tracker ownership rewrite | PASS; all CI/CD/testing rows are Codex-owned. | 2026-06-05 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Path-aware CI, security gates, SBOM, container build/scan, frontend CI/CD, analytics lane, and local e2e harness landed. |
| 2026-06-05 | Took ownership of deploy handoff rows from Claude. |
| 2026-06-05 | Rephrased tracker for Codex ownership of all CI/CD/testing rows. |
