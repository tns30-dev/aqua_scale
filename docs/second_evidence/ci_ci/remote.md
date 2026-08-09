# Remote CI/CD Evidence

Date: 2026-08-09

Target runtime: GKE project `aquashield-ms-dev-20260808`, namespace `aquashield-dev`, public API `https://api.aquashield.live`.

## Pipeline Record

| Area | Evidence |
|---|---|
| CI build, test, and security | GitHub Actions run `31283049602` passed for commit `c43396176163984d5e41f4c384205e5e8b41e780`. Jobs passed: Gitleaks secret scan, CycloneDX SBOM, Trivy dependency/config scan, Semgrep SAST, Ingestion Service build/test, Ingestion Service container build/image scan, and CI evidence publishing. |
| Container release and GitOps handoff | GitHub Actions run `31283262258` passed for the same commit. It authenticated to Google Cloud through OIDC/WIF, logged in to Artifact Registry, built the ingestion image, scanned it with Trivy, pushed it to Artifact Registry, updated Kustomize image tags, and committed the Argo CD manifest update. |
| Current CI guardrail | GitHub Actions run `31285420018` passed for commit `4b16fb8472c1036258fa5ae05f94b9ef9efc5350`, proving the current main branch still passes the CI/security matrix after the DAST artifact fix. |
| Current GitOps state | Argo CD application `argocd/aquashield-dev` watches `k8s/overlays/performance-managed-public` and reports `Synced` / `Healthy` at revision `4b16fb8472c1036258fa5ae05f94b9ef9efc5350`. |

## Live Deployment Record

| Service | Live image |
|---|---|
| `analytics-service` | `asia-southeast1-docker.pkg.dev/aquashield-ms-dev-20260808/analytics-service/analytics-service:f85dcebd8115` |
| `audit-service` | `asia-southeast1-docker.pkg.dev/aquashield-ms-dev-20260808/audit-service/audit-service:b88b45f5a738` |
| `identity-access-service` | `asia-southeast1-docker.pkg.dev/aquashield-ms-dev-20260808/identity-access-service/identity-access-service:b88b45f5a738` |
| `ingestion-service` | `asia-southeast1-docker.pkg.dev/aquashield-ms-dev-20260808/ingestion-service/ingestion-service:c43396176163` |
| `notification-service` | `asia-southeast1-docker.pkg.dev/aquashield-ms-dev-20260808/notification-service/notification-service:b88b45f5a738` |
| `pond-service` | `asia-southeast1-docker.pkg.dev/aquashield-ms-dev-20260808/pond-service/pond-service:42702daa1c2d` |
| `project-service` | `asia-southeast1-docker.pkg.dev/aquashield-ms-dev-20260808/project-service/project-service:51eafd5cb65b` |
| `realtime-gateway` | `asia-southeast1-docker.pkg.dev/aquashield-ms-dev-20260808/realtime-gateway/realtime-gateway:b88b45f5a738` |
| `sensor-service` | `asia-southeast1-docker.pkg.dev/aquashield-ms-dev-20260808/sensor-service/sensor-service:b88b45f5a738` |
| `api-edge-proxy` | `nginxinc/nginx-unprivileged:1.27-alpine` |

Runtime status: all ten long-running application deployments are `Running` with `2/2` containers ready. The old `pond-daily-health` completed job appears in pod history and is not part of the live service set.
