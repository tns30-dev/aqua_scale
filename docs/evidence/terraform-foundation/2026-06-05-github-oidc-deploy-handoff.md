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

## Next Test

Push this workflow to `main`, then manually dispatch:

```bash
gh workflow run deploy-handoff.yml --ref main -f services=identity-access-service
```

Expected proof:

- `identity-access-service` image exists in Artifact Registry with the full Git SHA tag.
- `identity-access-service` image exists with the short Git SHA tag.
- `k8s/overlays/dev/kustomization.yaml` points to the short Git SHA image.
