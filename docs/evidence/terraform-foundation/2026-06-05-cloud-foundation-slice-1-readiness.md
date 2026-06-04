# Cloud Foundation Slice 1 Readiness

Date: 2026-06-05

## Scope

Prepared and executed the first controlled GCP cloud foundation slice:

- GCS Terraform state bootstrap variables.
- Dev Terraform variables.
- Local-only backend/terraform variable handling.
- Cloud foundation runbook.
- GCS remote-state bucket apply.
- Artifact Registry targeted apply.

Network, GKE, NAT, firewall, and Cloud Armor resources were intentionally left unapplied after the Artifact Registry slice.

## Files

| File | Purpose |
|---|---|
| `infra/bootstrap-state/terraform.tfvars.example` | Non-secret template for the one-time state bucket apply |
| `infra/environments/dev/terraform.tfvars.example` | Non-secret template for the dev foundation plan |
| `docs/CLOUD_FOUNDATION_SLICE_1.md` | Operator runbook and cost guardrails |
| `docs/evidence/terraform-foundation/2026-06-05-artifact-registry-apply.md` | Artifact Registry apply and verification evidence |
| `.gitignore` | Keeps real backend and tfvars files local |

## Validation

| Check | Result |
|---|---|
| `terraform fmt -check -recursive infra` | PASS |
| `terraform -chdir=infra/bootstrap-state validate` | PASS after elevated rerun; sandboxed run could not execute cached Google provider plugin |
| `terraform -chdir=infra/environments/dev validate` | PASS after elevated rerun; sandboxed run could not execute cached Google provider plugin |
| `kubectl kustomize k8s/overlays/dev` | PASS |
| `kubectl kustomize k8s/overlays/staging` | PASS |
| `terraform -chdir=infra/bootstrap-state plan -var-file=terraform.tfvars` | PASS; final plan was `1 to add, 0 to change, 0 to destroy` against `aerobic-guide-498413-u6` |
| `terraform -chdir=infra/bootstrap-state apply /tmp/aquashield-bootstrap-state.tfplan` | PASS; created state bucket |
| `terraform -chdir=infra/bootstrap-state state list` | PASS; `google_storage_bucket.terraform_state` recorded |
| `gcloud storage buckets list --project=aerobic-guide-498413-u6` | PASS; bucket visible with uniform bucket-level access enabled |
| `terraform -chdir=infra/environments/dev init -reconfigure` | PASS; GCS backend configured |
| `terraform -chdir=infra/environments/dev plan -var-file=terraform.tfvars` | PASS; plan saved at `/tmp/aquashield-dev-foundation.tfplan`, `24 to add, 0 to change, 0 to destroy` |
| `terraform -chdir=infra/environments/dev plan -target=google_project_service.required -target=module.artifact_registry` | PASS; plan saved at `/tmp/aquashield-artifact-registry.tfplan`, `15 to add, 0 to change, 0 to destroy` |
| `terraform -chdir=infra/environments/dev apply /tmp/aquashield-artifact-registry.tfplan` | PASS; six project APIs and nine Docker repositories created |
| `gcloud artifacts repositories list --project=aerobic-guide-498413-u6 --location=asia-southeast1` | PASS; nine repositories visible |
| `terraform -chdir=infra/environments/dev plan -var-file=terraform.tfvars` after Artifact Registry apply | PASS; remaining plan saved at `/tmp/aquashield-dev-foundation-after-registry.tfplan`, `9 to add, 0 to change, 0 to destroy` |

## Project Selection Notes

Initial project from gcloud config was `aqua-monitoring-496819`, but `aquashieldnus@gmail.com` does not have storage permissions there.

Project `aquashield-498413` was visible and storage access worked, but billing was not enabled.

Final selected project:

```text
aerobic-guide-498413-u6
```

It is visible to `aquashieldnus@gmail.com`, has billing enabled, and accepted the Terraform state bucket create.

## Created Remote State

```text
Bucket: aquashield-aerobic-guide-498413-u6-tfstate
Location: ASIA-SOUTHEAST1
Uniform bucket-level access: true
Public access prevention: enforced
Versioning: enabled
```

## Created Artifact Registry Repositories

```text
Location: asia-southeast1
Format: DOCKER

analytics-service
audit-service
identity-access-service
ingestion-service
notification-service
pond-service
project-service
realtime-gateway
sensor-service
```

## Next Test

Review cost and apply the remaining dev foundation only after approval. Use the post-registry plan or create a fresh plan; do not apply the stale pre-registry `/tmp/aquashield-dev-foundation.tfplan`.

```bash
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token --account=aquashieldnus@gmail.com)" \
  terraform -chdir=infra/environments/dev apply /tmp/aquashield-dev-foundation-after-registry.tfplan
```
