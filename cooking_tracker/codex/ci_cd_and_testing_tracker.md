# CI/CD And Testing Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns CI/CD, GitOps handoff, Argo CD rollout proof, post-deploy smoke tests, DAST, JMeter, and demo evidence.
- Current state: Path-aware CI is proven and already builds/tests/scans/containerizes changed services. Artifact Registry repositories and GitHub OIDC/WIF are provisioned; `deploy-handoff.yml` is ready to push Git-SHA-tagged images and update the dev Kustomize tag.
- Current test: GitHub Actions CI evidence, Terraform WIF apply, deploy-handoff workflow validation, local Kustomize render, local e2e harness, and security gate evidence.
- Next test: Push the workflow to `main`, manually dispatch `identity-access-service`, then verify the Artifact Registry tags and Kustomize commit.
- Inputs ready from user: GCP account, project, region, repositories, WIF provider, and deployer service account are ready. Still need Argo CD deployment decision for live rollout.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Path-aware CI workflows | DONE | Proven on GitHub for Java services and analytics lane. Security gates, SBOM, container build/scan, and changed-service matrix exist. | `../../.github/workflows/ci.yml`, `../../docs/evidence/ci/2026-06-04-ci-skeleton-and-dependency-hardening.txt` | 2026-06-04 |
| Artifact Registry push | IN_PROGRESS | `deploy-handoff.yml` can authenticate through GitHub OIDC/WIF, build selected services, scan images, and push full/short Git SHA tags. Live GitHub dispatch evidence pending. | `../../.github/workflows/deploy-handoff.yml`, `../../infra/modules/github-oidc/`, `../../docs/evidence/terraform-foundation/2026-06-05-github-oidc-deploy-handoff.md` | 2026-06-05 |
| GitOps manifest update | IN_PROGRESS | `deploy-handoff.yml` updates `k8s/overlays/dev/kustomization.yaml` after image push and commits the Kustomize tag change back to `main`. Live GitHub dispatch evidence pending. | `../../.github/workflows/deploy-handoff.yml`, `../../k8s/overlays/dev/`, `../main/ci.md`, `../main/cd.md` | 2026-06-05 |
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

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Path-aware CI, security gates, SBOM, container build/scan, frontend CI/CD, analytics lane, and local e2e harness landed. |
| 2026-06-05 | Took ownership of deploy handoff rows from Claude. |
| 2026-06-05 | Rephrased tracker for Codex ownership of all CI/CD/testing rows. |
| 2026-06-05 | Artifact Registry cloud prerequisite completed. CI push remains pending until GitHub OIDC/WIF is configured. |
| 2026-06-05 | Provisioned GitHub OIDC/WIF deploy identity and added `deploy-handoff.yml` for selected-service image push plus dev Kustomize tag update. |
