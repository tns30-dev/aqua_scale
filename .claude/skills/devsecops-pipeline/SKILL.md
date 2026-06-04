---
name: devsecops-pipeline
description: Use when building CI/CD — path-aware GitHub Actions for the monorepo (changed-service matrix), lint/test/contract jobs, SAST/SCA/secret-scan/SBOM/container-scan gates, OIDC/WIF auth to GCP, Artifact Registry push, Kustomize GitOps handoff to Argo CD, post-deploy smoke + OWASP ZAP DAST, and JMeter load/stress on the performance-test branch. Trigger on "CI", "workflow", "pipeline", "scan", "SBOM", "JMeter", "ZAP", "GitOps handoff".
---

# DevSecOps pipeline (specs: `main/ci.md`, `main/cd.md`)

## Decided pipeline shape

```
push → detect-changes → [per changed service matrix]
  lint → unit/integration tests → contract checks (proto/OpenAPI)
  → SAST · SCA · secret-scan · SBOM
  → container build → image scan → push to Artifact Registry (tag = git SHA)
  → update Kustomize image tag (GitOps commit) → Argo CD syncs
  → post-deploy: smoke tests → OWASP ZAP baseline (live endpoint) 
performance-test branch / manual dispatch only → JMeter load + stress → .jtl + HTML reports
```

## Path filters (decided — flat layout, services at repo root)

`<service-name>/**` (e.g. `identity-access-service/**`) → that service only ·
`shared-api/**` or `common/**` → contract/lib build + affected services · `k8s/**` →
manifest validation (kustomize build + kubeconform) · `infra/**` → terraform
fmt/validate/plan. **Evidence requirement:** a commit touching only Identity runs only the
Identity pipeline — capture that run.

## Job/tool matrix

| Concern | Java services (Maven) | TS (analytics, lambda) |
|---|---|---|
| Lint | spotless/checkstyle | eslint |
| Unit/integration | `mvn -pl <service> test` (+ Testcontainers) | npm test |
| SAST | Semgrep (+ CodeQL if quota) | Semgrep/eslint-security |
| SCA | OWASP Dependency-Check maven plugin | `npm audit` + Dependabot |
| Secrets | Gitleaks (repo-wide job) | same |
| SBOM | CycloneDX maven plugin | CycloneDX npm |
| Container scan | Trivy image | Trivy image |

Upload every report as a workflow artifact — they ARE the security evidence.

## CI security posture (non-negotiable)

- **GitHub OIDC → GCP Workload Identity Federation** — zero long-lived cloud keys.
- CI SA: Artifact Registry push + GitOps-repo write only. Pinned action SHAs. Scoped
  `GITHUB_TOKEN` permissions. Branch protection on main; environments with approval for staging.
- Fail the gate on: any leaked secret, CRITICAL vulns (image/deps), failed tests/contracts.
  Documented, justified exceptions only.

## CI ↔ CD boundary (decided)

CI: build, test, scan, SBOM, push image, bump Kustomize tag. **CD = Argo CD** reconciles
GKE to the GitOps commit; CI never runs `kubectl apply`. Post-deploy jobs wait for Argo
health, then smoke-test, then ZAP (authenticated scan if feasible). Rollback = revert the
GitOps commit (restore previous tag/digest), not rebuild.

## JMeter (kept out of daily CI)

Plans in `jmeter/*.jmx`, parameterized (baseURL, users, ramp-up, duration). Run against
deployed dev/staging from the `performance-test` branch or manual dispatch. Keep raw `.jtl`,
HTML report, and a throughput/p95/p99/error-rate summary as artifacts.

## Reusable structure

`.github/workflows/`: `ci.yml` (matrix), `deploy-handoff.yml`, `dast.yml`, `perf.yml`;
shared composite actions in `.github/actions/` (java-build, ts-build, scan-suite).

After every pipeline milestone → update `cooking_tracker/claude/ci_cd_and_testing_tracker.md`
(+ `security_tracker.md` for the scan-evidence item).
