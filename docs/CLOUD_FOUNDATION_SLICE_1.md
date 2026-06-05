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

The remote-state bucket, Artifact Registry repositories, GitHub OIDC/WIF deploy identity, and all nine Git-SHA-tagged service image pushes are already complete. The next test is applying the remaining dev foundation plan after accepting the GKE/network cost surface.

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

The first deploy handoff proof run succeeded for `identity-access-service`:

```text
Run: https://github.com/tns30-dev/aqua_scale/actions/runs/26970676442
Image tags: 88db1611e9a4, 88db1611e9a4f91141efe00208c67023406e79e3
Digest: sha256:b6b9d8d5e25ee1577336bf54528ed820e8a7a401adb684a72496501bf9f3bd07
GitOps commit: f2c55fb
```

The all-service image backfill also succeeded:

```text
Run: https://github.com/tns30-dev/aqua_scale/actions/runs/26971844902
Image tags: 783c78a16381, 783c78a16381c7ce2056d0aae7b67d29395b1481
Services: analytics-service, audit-service, identity-access-service, ingestion-service, notification-service, pond-service, project-service, realtime-gateway, sensor-service
Current reachable GitOps commit: c6724db
```

Repository metadata cleanup verification also passed:

```text
CI run: https://github.com/tns30-dev/aqua_scale/actions/runs/26989856501
Deploy-handoff run: https://github.com/tns30-dev/aqua_scale/actions/runs/26989888972
```

The original full dev plan at `/tmp/aquashield-dev-foundation.tfplan` is now stale because the registry, WIF, and runtime resources have already been applied.

Runtime foundation apply evidence:

```text
Evidence: docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md
Cluster: aquashield-dev-gke
Network: aquashield-dev-vpc
Subnet: aquashield-dev-gke-subnet
Terraform final plan: no changes
```

Cloud Armor remains in the architecture/design docs, but runtime implementation evidence is out of scope for this build. The project also has zero quota for `SECURITY_POLICIES`, `SECURITY_POLICY_RULES`, and `SECURITY_POLICY_CEVAL_RULES`, so dev Terraform sets `enable_cloud_armor = false`.

The next cloud slice is Istio plus Argo CD rollout proof, not another Terraform foundation apply.
