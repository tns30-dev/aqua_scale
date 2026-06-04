# AquaShield Terraform

Terraform owns the repeatable cloud foundation for the GCP-primary AquaShield deployment.

## Layout

| Path | Purpose |
|---|---|
| `bootstrap-state/` | One-time GCS bucket creation for Terraform remote state |
| `environments/dev/` | Dev environment root module |
| `modules/network/` | Custom VPC, subnet, secondary ranges, NAT, firewall rules |
| `modules/gke/` | GKE cluster, node pool, Workload Identity, Gateway API support |
| `modules/artifact-registry/` | Docker repositories for service images |
| `modules/security/` | Cloud Armor policy foundation |

## State Flow

1. Run `bootstrap-state/` once with local state to create the GCS state bucket.
2. Copy `environments/dev/backend.tf.example` to `environments/dev/backend.tf`.
3. Replace the backend bucket name.
4. Run `terraform init`, `terraform plan`, and apply only after reviewing cost.

Use `docs/CLOUD_FOUNDATION_SLICE_1.md` for the controlled first cloud slice. Real `terraform.tfvars` files and `environments/*/backend.tf` are local-only and ignored by git.

Current dev state already contains the GCS remote-state bucket, the nine per-service Artifact Registry Docker repositories, and the GitHub OIDC/WIF deploy identity. The remaining foundation plan creates the VPC, subnet, NAT, firewall, Cloud Armor policy, and GKE cluster/node pool.

## Cost Guardrails

The dev GKE cluster defaults to one zone through `gke_cluster_location` to avoid accidentally creating a more expensive regional node footprint. Bigtable, BigQuery, Cloud SQL, Redis, and AWS IoT resources are intentionally not created in this first scaffold. Add them only when the implementation needs them and cost controls are clear.
