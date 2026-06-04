# Cloud Foundation Slice 1

This slice prepares a safe first cloud plan/apply path for the GCP foundation. It does not create AWS IoT, Cloud SQL, Memorystore, Bigtable, BigQuery, or Pub/Sub yet.

## Scope

| Included | Purpose |
|---|---|
| GCS Terraform state bucket | Shared remote state for later infrastructure work |
| Dev Terraform backend config | Makes dev state reproducible after bootstrap |
| VPC, subnet, secondary ranges | Network base for GKE |
| Private-node GKE scaffold | Runtime base for Kubernetes workloads |
| Artifact Registry repositories | Destination for service images |
| Cloud Armor policy scaffold | Security base for API edge |

## Required Local Inputs

| Input | Example |
|---|---|
| GCP project ID | `aerobic-guide-498413-u6` |
| GCP region | `asia-southeast1` |
| GKE zone | `asia-southeast1-a` |
| State bucket name | `aquashield-aerobic-guide-498413-u6-tfstate` |

## Preconditions

1. Confirm billing is enabled on the GCP project.
2. Authenticate locally with Application Default Credentials:

```bash
gcloud auth application-default login
gcloud config set project REPLACE_WITH_GCP_PROJECT_ID
```

3. Review `infra/bootstrap-state/terraform.tfvars.example` and `infra/environments/dev/terraform.tfvars.example`.

## IAM Needed

| Step | Minimum practical role |
|---|---|
| Bootstrap state bucket | `roles/storage.admin` on the target project |
| Enable project APIs in dev foundation | `roles/serviceusage.serviceUsageAdmin` |
| VPC, subnet, NAT, firewall | `roles/compute.networkAdmin` |
| GKE cluster/node pool | `roles/container.admin` plus service account permissions as required by GKE |
| Artifact Registry repositories | `roles/artifactregistry.admin` |
| Cloud Armor policy | `roles/compute.securityAdmin` |

## Bootstrap Remote State

```bash
cd infra/bootstrap-state
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with the real project ID and globally unique bucket name.
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

After the bucket exists, configure the dev backend:

```bash
cd ../environments/dev
cp backend.tf.example backend.tf
# Edit backend.tf bucket to match the created state bucket.
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with the real project ID and region/zone.
terraform init
terraform plan -out=tfplan
```

Do not apply dev until the plan is reviewed for cost and resource names.

## Cost Guardrails

| Control | Default |
|---|---|
| GKE footprint | Single-zone cluster |
| Node machine | `e2-standard-2` |
| Autoscaling | 1 to 3 nodes |
| Data services | Not created in this slice |
| AWS resources | Not created in this slice |

## Current Test

Run this before any cloud command:

```bash
terraform fmt -check -recursive infra
terraform -chdir=infra/bootstrap-state validate
terraform -chdir=infra/environments/dev validate
kubectl kustomize k8s/overlays/dev >/tmp/aquashield-dev.yaml
kubectl kustomize k8s/overlays/staging >/tmp/aquashield-staging.yaml
```

## Next Test

The remote-state bucket, Artifact Registry repositories, and GitHub OIDC/WIF deploy identity are already created. The next test is either:

- Applying the remaining dev foundation plan after accepting the GKE/network cost surface.
- Proving one Git-SHA-tagged image push through the `deploy-handoff` workflow.

## Current Status

The state bucket was created successfully in project `aerobic-guide-498413-u6` with active account `aquashieldnus@gmail.com`.

Created bucket:

```text
aquashield-aerobic-guide-498413-u6-tfstate
```

The Artifact Registry targeted apply also succeeded. Nine Docker repositories now exist in `asia-southeast1`:

```text
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

GitHub OIDC/WIF also succeeded. GitHub Actions can impersonate `aquashield-github-deployer@aerobic-guide-498413-u6.iam.gserviceaccount.com` from `tns30-dev/aqua_scale` on `refs/heads/main` and can push only to the nine service repositories.

The original full dev plan at `/tmp/aquashield-dev-foundation.tfplan` is now stale because the registry and WIF resources have already been applied. A fresh post-WIF dev foundation plan succeeds and is saved locally at `/tmp/aquashield-dev-foundation-after-wif.tfplan`. It proposes 9 resources: VPC/subnet/NAT/firewall, Cloud Armor policy, and a single-zone private-node GKE cluster/node pool.

Do not apply the remaining dev foundation until the GKE/network cost is accepted.

```bash
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token --account=aquashieldnus@gmail.com)" \
  terraform -chdir=infra/environments/dev apply /tmp/aquashield-dev-foundation-after-wif.tfplan
```
