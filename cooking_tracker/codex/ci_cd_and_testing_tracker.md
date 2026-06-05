# CI/CD And Testing Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns CI/CD, GitOps handoff, Argo CD rollout proof, post-deploy smoke tests, DAST, JMeter, and demo evidence.
- Current state: Path-aware CI is proven and already builds/tests/scans/containerizes changed services. `deploy-handoff.yml` pushed all nine implemented service images to Artifact Registry. The live `aquashield-dev` Argo CD Application targets `k8s/overlays/dev-managed`, eight Java services are rebuilt at tag `bef15c6`, analytics remains at `783c78a16381`, and the managed-backed business smoke passed.
- Current test: GitHub Actions CI evidence, Terraform WIF apply, all-service deploy-handoff run, Artifact Registry tag verification, local Kustomize render, GKE runtime foundation verification, Istio/Argo CD install, managed Argo sync, all-service readiness checks, managed business-flow smoke, and AWS bridge code-readiness checks.
- Next test: AWS IoT/Lambda live smoke after credentials are refreshed, then public API edge/Firebase smoke and DAST.
- Inputs ready from user: GCP account, project, region, repositories, WIF provider, deployer service account, GKE cluster, Istio, and Argo CD are ready. AWS credentials currently return `InvalidClientTokenId`; public edge/domain choice remains pending.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Path-aware CI workflows | DONE | Proven on GitHub for Java services and analytics lane. Security gates, SBOM, container build/scan, and changed-service matrix exist. | `../../.github/workflows/ci.yml`, `../../docs/evidence/ci/2026-06-04-ci-skeleton-and-dependency-hardening.txt` | 2026-06-04 |
| Artifact Registry push | DONE | `deploy-handoff.yml` authenticated through GitHub OIDC/WIF, built all nine implemented services, passed Trivy image scans, and pushed full/short Git SHA tags to Artifact Registry. | `../../.github/workflows/deploy-handoff.yml`, `../../infra/modules/github-oidc/`, `../../docs/evidence/terraform-foundation/2026-06-05-github-oidc-deploy-handoff.md` | 2026-06-05 |
| GitOps manifest update | DONE | Current managed overlay rolls analytics at `783c78a16381` and the eight Java services at `bef15c6`; GitOps commit `a057b0b` is live. | `../../.github/workflows/deploy-handoff.yml`, `../../k8s/overlays/dev-full/kustomization.yaml`, `../main/ci.md`, `../main/cd.md`, `../../docs/evidence/gitops/2026-06-05-managed-business-flow-smoke.md` | 2026-06-05 |
| Argo CD rollout | DONE | Argo CD synced the private GitHub repo at revision `a057b0b86f03834213b543d10e9b1fa0785eeda3`, targets `k8s/overlays/dev-managed`, and reports `Synced/Healthy`. | `../main/cd.md`, `../main/gke.md`, `../../k8s/argocd/aquashield-dev-application.yaml`, `../../docs/evidence/gitops/2026-06-05-argocd-dev-managed-rollout.md` | 2026-06-05 |
| Smoke tests | DONE | Managed business-flow smoke passed: login/audit, project/pond setup, sensor mapping, signed telemetry to real Pub/Sub, energy read model, active threshold alert, pond comparison, analytics JSON, realtime token, and audit rows. | `../../scripts/smoke-managed-business-flow.py`, `../../docs/evidence/gitops/2026-06-05-managed-business-flow-smoke.md` | 2026-06-05 |
| DAST | TODO | Requires deployed dev/staging API endpoint. Plan is OWASP ZAP baseline after Argo CD health and smoke pass. | `../main/cd.md` | 2026-06-05 |
| JMeter load and stress tests | TODO | `perf.yml` lane exists; concrete plans/evidence are pending. Should run only on `performance-test` branch or manual dispatch. | `../../.github/workflows/perf.yml`, `../main/ci.md` | 2026-06-05 |
| Demo evidence | IN_PROGRESS | Managed runtime smoke and AWS bridge code-readiness evidence exist. AWS live logs/screenshots, public edge, DAST, and performance evidence remain. | `../../docs/evidence/` | 2026-06-05 |

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
| All-service Artifact Registry backfill | PASS; run `26971844902` built, scanned, and pushed all nine service images. | 2026-06-05 |
| All-service GitOps tag update | PASS; current reachable commit `c6724db` points every dev service image to `783c78a16381`. | 2026-06-05 |
| Repository metadata cleanup verification | PASS; CI run `26989856501` and deploy-handoff run `26989888972` completed successfully after the `main` history cleanup. | 2026-06-05 |
| GKE runtime foundation | PASS; Terraform-managed VPC, NAT, firewall, private-node GKE cluster, and node pool are live and plan clean. | 2026-06-05 |
| Istio install | PASS; Istio `1.30.1` control plane, CNI, GatewayClass, and security CRDs are live. | 2026-06-05 |
| Argo CD install | PASS; Argo CD `v3.4.3` installed with server-side apply after repairing the ApplicationSet CRD annotation limit. | 2026-06-05 |
| Full dev rollout preflight | LIMITED; full nine-service dev overlay synced but stayed degraded because free-credit quota and missing PostgreSQL/Redis/Pub/Sub/JWT runtime dependencies blocked health. | 2026-06-05 |
| Quota-safe dev smoke rollout | PASS; `aquashield-dev` points to `k8s/overlays/dev-smoke`, Argo reports `Synced/Healthy`, and analytics `/healthz` passed. | 2026-06-05 |
| Full dev runtime rollout | PASS; `aquashield-dev` points to `k8s/overlays/dev-full`, Argo reports `Synced/Healthy`, and all nine service pods are ready. | 2026-06-05 |
| Managed GCP overlay render | PASS; `kubectl kustomize k8s/overlays/dev-managed` renders after adding Terraform-managed data cutover manifests. | 2026-06-05 |
| Managed dev runtime rollout | PASS; `aquashield-dev` points to `k8s/overlays/dev-managed`, Argo reports `Synced/Healthy`, and all nine service pods are `2/2 Running`. | 2026-06-05 |
| Managed business-flow smoke | PASS; run `DEV-CLOUD-SMOKE-20260605-140646` produced `energyTotalKwh=3.1`, `activeAlerts=1`, `comparisonMetricCount=4`, `realtimeTokenMinted=true`, and `auditSecurityRows=3`. | 2026-06-05 |
| AWS bridge code readiness | PASS; Lambda unit tests/build/package, production dependency audit, event schema validation, and Terraform validation passed. | 2026-06-05 |
| AWS bridge live smoke | BLOCKED; AWS CLI default and `tns_admin` profiles return `InvalidClientTokenId`. | 2026-06-05 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Path-aware CI, security gates, SBOM, container build/scan, frontend CI/CD, analytics lane, and local e2e harness landed. |
| 2026-06-05 | Took ownership of deploy handoff rows from Claude. |
| 2026-06-05 | Rephrased tracker for Codex ownership of all CI/CD/testing rows. |
| 2026-06-05 | Artifact Registry cloud prerequisite completed. CI push remains pending until GitHub OIDC/WIF is configured. |
| 2026-06-05 | Provisioned GitHub OIDC/WIF deploy identity and added `deploy-handoff.yml` for selected-service image push plus dev Kustomize tag update. |
| 2026-06-05 | Proved the deploy handoff through GitHub Actions run `26970676442`: WIF auth, Docker login, build, Trivy scan, Artifact Registry push, and Kustomize tag commit all passed. |
| 2026-06-05 | Ran all-service image backfill through GitHub Actions run `26971844902`; all nine repositories now have full/short Git SHA tags, and the dev overlay points all services to tag `783c78a16381`. |
| 2026-06-05 | Re-verified the repository after metadata cleanup: CI run `26989856501` and deploy-handoff run `26989888972` both passed. |
| 2026-06-05 | Runtime GKE foundation went live. At this point Argo CD rollout was gated by Istio CRD/control-plane installation or a split sync design. |
| 2026-06-05 | Installed Istio and Argo CD, connected Argo to the private GitHub repo, proved full dev sync mechanics, then moved live rollout to quota-safe `dev-smoke` because the full stack needs managed data/messaging and more quota. |
| 2026-06-05 | Argo CD `aquashield-dev` synced commit `6ce1f08` from `k8s/overlays/dev-smoke` and reported `Synced/Healthy`; analytics `/healthz` returned `{"status":"UP"}`. |
| 2026-06-05 | Promoted Argo CD to `k8s/overlays/dev-full`; all nine services became ready on in-cluster Postgres/Redis/Pub/Sub emulator dependencies. Added `k8s/overlays/dev-managed` for the real GCP data/messaging cutover. |
| 2026-06-05 | Cut Argo CD to `k8s/overlays/dev-managed`; all nine services became ready on managed Cloud SQL, Memorystore Redis, and real Google Pub/Sub. |
| 2026-06-05 | Rebuilt the eight Java services at tag `bef15c6` after removing baked Pub/Sub emulator configuration, rolled them through Argo CD at commit `a057b0b`, and passed the managed business-flow smoke. |
| 2026-06-05 | Added AWS IoT/Lambda bridge code and Terraform readiness evidence; live smoke waits on valid AWS credentials and account ID. |
