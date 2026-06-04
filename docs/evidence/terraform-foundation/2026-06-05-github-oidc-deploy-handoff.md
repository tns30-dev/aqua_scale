# GitHub OIDC Deploy Handoff Evidence

Date: 2026-06-05

## Scope

Provisioned the keyless CI/CD handoff path from GitHub Actions to GCP Artifact Registry.

Included:

- IAM and STS APIs.
- GitHub Actions Workload Identity Pool and Provider.
- Deployer service account.
- Repository-level Artifact Registry writer bindings for the nine service repositories.
- `deploy-handoff` GitHub Actions workflow for image push and dev Kustomize tag update.

Excluded:

- GKE rollout and Argo CD sync. Those need the remaining network/GKE foundation.
- Post-deploy smoke, DAST, and JMeter. Those need a live endpoint.

## Target

```text
GCP project: aerobic-guide-498413-u6
GitHub repository: tns30-dev/aqua_scale
Allowed GitHub ref: refs/heads/main
Artifact Registry location: asia-southeast1
Service account: aquashield-github-deployer@aerobic-guide-498413-u6.iam.gserviceaccount.com
WIF provider: projects/294489509399/locations/global/workloadIdentityPools/github-actions/providers/github-actions
```

## Terraform Plan

Command:

```bash
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token --account=aquashieldnus@gmail.com)" \
  terraform -chdir=infra/environments/dev plan \
    -var-file=terraform.tfvars \
    -target='google_project_service.required["iam.googleapis.com"]' \
    -target='google_project_service.required["sts.googleapis.com"]' \
    -target=module.github_oidc \
    -out=/tmp/aquashield-github-oidc.tfplan
```

Result:

```text
Plan: 15 to add, 0 to change, 0 to destroy.
```

Planned resources:

- `iam.googleapis.com`
- `sts.googleapis.com`
- `google_service_account.github_deployer`
- `google_iam_workload_identity_pool.github`
- `google_iam_workload_identity_pool_provider.github`
- `google_service_account_iam_member.github_workload_identity_user`
- Nine `google_artifact_registry_repository_iam_member.github_writer` bindings.

## Terraform Apply

Command:

```bash
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token --account=aquashieldnus@gmail.com)" \
  terraform -chdir=infra/environments/dev apply /tmp/aquashield-github-oidc.tfplan
```

Result:

```text
Apply complete! Resources: 15 added, 0 changed, 0 destroyed.
```

Outputs:

```text
github_deployer_service_account = "aquashield-github-deployer@aerobic-guide-498413-u6.iam.gserviceaccount.com"
github_workload_identity_provider = "projects/294489509399/locations/global/workloadIdentityPools/github-actions/providers/github-actions"
```

## Workflow Design

Workflow:

```text
.github/workflows/deploy-handoff.yml
```

Trigger behavior:

- Runs after `ci` completes successfully on `main`.
- Can be manually dispatched for a specific service, defaulting to `identity-access-service`.
- Selects only changed services for normal `main` handoff.
- Authenticates to GCP through Workload Identity Federation.
- Builds each selected service image with full Git SHA and short Git SHA tags.
- Runs a Trivy CRITICAL gate before pushing.
- Pushes to the matching per-service Artifact Registry Docker repository.
- Updates `k8s/overlays/dev/kustomization.yaml` with the short Git SHA image tag.
- Commits the GitOps tag update back to `main` with `[skip ci]`.

## Validation

| Check | Result |
|---|---|
| `terraform fmt -check -recursive infra` | PASS |
| `terraform -chdir=infra/environments/dev validate` | PASS after elevated rerun; sandboxed run could not execute cached Google provider plugin |
| `terraform -chdir=infra/environments/dev plan -var-file=terraform.tfvars` after WIF apply | PASS; remaining plan is `9 to add, 0 to change, 0 to destroy` for network/GKE/Cloud Armor only |
| Ruby YAML parse for `deploy-handoff.yml` | PASS |

## Initial GitHub Proof Run

Run:

```text
https://github.com/tns30-dev/aqua_scale/actions/runs/26970676442
```

Run summary:

```text
event: workflow_dispatch
conclusion: success
headSha: 88db1611e9a4f91141efe00208c67023406e79e3
createdAt: 2026-06-04T18:13:29Z
updatedAt: 2026-06-04T18:16:03Z
```

Jobs:

| Job | Result |
|---|---|
| `detect-changes` | PASS |
| `build-push (identity-access-service)` | PASS; WIF auth, Docker login, build, Trivy image scan, and push completed |
| `gitops-update` | PASS; dev Kustomize image tag committed back to `main` |

## All-Service Backfill Run

Run:

```text
https://github.com/tns30-dev/aqua_scale/actions/runs/26971844902
```

Run summary:

```text
event: workflow_dispatch
conclusion: success
headSha: 783c78a16381c7ce2056d0aae7b67d29395b1481
createdAt: 2026-06-04T18:35:55Z
updatedAt: 2026-06-04T18:38:51Z
```

Jobs:

| Job | Result |
|---|---|
| `detect-changes` | PASS |
| `build-push (analytics-service)` | PASS; WIF auth, Docker login, build, Trivy image scan, and push completed |
| `build-push (audit-service)` | PASS; WIF auth, Docker login, build, Trivy image scan, and push completed |
| `build-push (identity-access-service)` | PASS; WIF auth, Docker login, build, Trivy image scan, and push completed |
| `build-push (ingestion-service)` | PASS; WIF auth, Docker login, build, Trivy image scan, and push completed |
| `build-push (notification-service)` | PASS; WIF auth, Docker login, build, Trivy image scan, and push completed |
| `build-push (pond-service)` | PASS; WIF auth, Docker login, build, Trivy image scan, and push completed |
| `build-push (project-service)` | PASS; WIF auth, Docker login, build, Trivy image scan, and push completed |
| `build-push (realtime-gateway)` | PASS; WIF auth, Docker login, build, Trivy image scan, and push completed |
| `build-push (sensor-service)` | PASS; WIF auth, Docker login, build, Trivy image scan, and push completed |
| `gitops-update` | PASS; dev Kustomize image tags committed back to `main` |

## Artifact Registry Proof

Command:

```bash
gcloud artifacts docker tags list \
  asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/identity-access-service/identity-access-service \
  --project=aerobic-guide-498413-u6 \
  --format='table(tag,version)'
```

Observed tags:

| Tag | Digest |
|---|---|
| `88db1611e9a4` | `sha256:b6b9d8d5e25ee1577336bf54528ed820e8a7a401adb684a72496501bf9f3bd07` |
| `88db1611e9a4f91141efe00208c67023406e79e3` | `sha256:b6b9d8d5e25ee1577336bf54528ed820e8a7a401adb684a72496501bf9f3bd07` |

All-service backfill verification:

```text
analytics-service: 783c78a16381, 783c78a16381c7ce2056d0aae7b67d29395b1481
audit-service: 783c78a16381, 783c78a16381c7ce2056d0aae7b67d29395b1481
identity-access-service: 783c78a16381, 783c78a16381c7ce2056d0aae7b67d29395b1481
ingestion-service: 783c78a16381, 783c78a16381c7ce2056d0aae7b67d29395b1481
notification-service: 783c78a16381, 783c78a16381c7ce2056d0aae7b67d29395b1481
pond-service: 783c78a16381, 783c78a16381c7ce2056d0aae7b67d29395b1481
project-service: 783c78a16381, 783c78a16381c7ce2056d0aae7b67d29395b1481
realtime-gateway: 783c78a16381, 783c78a16381c7ce2056d0aae7b67d29395b1481
sensor-service: 783c78a16381, 783c78a16381c7ce2056d0aae7b67d29395b1481
```

## GitOps Manifest Proof

Initial workflow-generated commit:

```text
f2c55fb chore(gitops): update dev images to 88db1611e9a4 [skip ci]
```

All-service workflow-generated commit:

```text
a0d64a4 chore(gitops): update dev images to 783c78a16381 [skip ci]
```

Dev overlay now points all nine services to Artifact Registry images with tag `783c78a16381`:

```yaml
images:
- name: analytics-service
  newName: asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/analytics-service/analytics-service
  newTag: 783c78a16381
- name: audit-service
  newName: asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/audit-service/audit-service
  newTag: 783c78a16381
- name: identity-access-service
  newName: asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/identity-access-service/identity-access-service
  newTag: 783c78a16381
- name: ingestion-service
  newName: asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/ingestion-service/ingestion-service
  newTag: 783c78a16381
- name: notification-service
  newName: asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/notification-service/notification-service
  newTag: 783c78a16381
- name: pond-service
  newName: asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/pond-service/pond-service
  newTag: 783c78a16381
- name: project-service
  newName: asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/project-service/project-service
  newTag: 783c78a16381
- name: realtime-gateway
  newName: asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/realtime-gateway/realtime-gateway
  newTag: 783c78a16381
- name: sensor-service
  newName: asia-southeast1-docker.pkg.dev/aerobic-guide-498413-u6/sensor-service/sensor-service
  newTag: 783c78a16381
```

Validation:

```text
kubectl kustomize k8s/overlays/dev
PASS
```

## Next Test

After the GKE/network foundation exists, install/connect Argo CD and prove that the GitOps image tag reconciles to a running pod:

```text
Argo CD sync -> healthy application -> running pod image digest matches Artifact Registry digest
```
