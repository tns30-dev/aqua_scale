# CI/CD And Testing Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns CI/CD, GitOps handoff, Argo CD rollout proof, post-deploy smoke tests, DAST, JMeter, and demo evidence.
- Current state: Path-aware CI is proven and already builds/tests/scans/containerizes changed services. `deploy-handoff.yml` successfully pushed a Git-SHA-tagged `identity-access-service` image to Artifact Registry and committed the dev Kustomize tag update.
- Current test: GitHub Actions CI evidence, Terraform WIF apply, deploy-handoff proof run, Artifact Registry tag verification, local Kustomize render, local e2e harness, and security gate evidence.
- Next test: After GKE is applied, install/connect Argo CD and prove sync plus healthy rollout from the GitOps tag.
- Inputs ready from user: GCP account, project, region, repositories, WIF provider, and deployer service account are ready. Still need Argo CD deployment decision for live rollout.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Path-aware CI workflows | DONE | Proven on GitHub for Java services and analytics lane. Security gates, SBOM, container build/scan, and changed-service matrix exist. | `../../.github/workflows/ci.yml`, `../../docs/evidence/ci/2026-06-04-ci-skeleton-and-dependency-hardening.txt` | 2026-06-04 |
| Artifact Registry push | DONE | `deploy-handoff.yml` authenticated through GitHub OIDC/WIF, built `identity-access-service`, passed Trivy, and pushed full/short Git SHA tags to Artifact Registry. | `../../.github/workflows/deploy-handoff.yml`, `../../infra/modules/github-oidc/`, `../../docs/evidence/terraform-foundation/2026-06-05-github-oidc-deploy-handoff.md` | 2026-06-05 |
| GitOps manifest update | DONE | `deploy-handoff.yml` committed the dev Kustomize image tag update back to `main` in commit `f2c55fb`. | `../../.github/workflows/deploy-handoff.yml`, `../../k8s/overlays/dev/kustomization.yaml`, `../main/ci.md`, `../main/cd.md`, `../../docs/evidence/terraform-foundation/2026-06-05-github-oidc-deploy-handoff.md` | 2026-06-05 |
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
| Artifact Registry cloud prerequisite | PASS; nine Docker repositories exist in `asia-southeast1`. | 2026-06-05 |
| GitHub OIDC/WIF deploy identity | PASS; provider, deployer service account, and repository-level writer IAM bindings are in Terraform state. | 2026-06-05 |
| Deploy handoff workflow validation | PASS; YAML parses and Terraform validation/full plan passed after WIF apply. | 2026-06-05 |
| Deploy handoff proof run | PASS; run `26970676442` pushed `identity-access-service` and committed the dev image tag. | 2026-06-05 |
| Artifact Registry tag verification | PASS; full SHA and short SHA tags exist for `identity-access-service` and point to digest `sha256:b6b9d8d5e25ee1577336bf54528ed820e8a7a401adb684a72496501bf9f3bd07`. | 2026-06-05 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Path-aware CI, security gates, SBOM, container build/scan, frontend CI/CD, analytics lane, and local e2e harness landed. |
| 2026-06-05 | Took ownership of deploy handoff rows from Claude. |
| 2026-06-05 | Rephrased tracker for Codex ownership of all CI/CD/testing rows. |
| 2026-06-05 | Artifact Registry cloud prerequisite completed. CI push remains pending until GitHub OIDC/WIF is configured. |
| 2026-06-05 | Provisioned GitHub OIDC/WIF deploy identity and added `deploy-handoff.yml` for selected-service image push plus dev Kustomize tag update. |
| 2026-06-05 | Proved the deploy handoff through GitHub Actions run `26970676442`: WIF auth, Docker login, build, Trivy scan, Artifact Registry push, and Kustomize tag commit all passed. |
