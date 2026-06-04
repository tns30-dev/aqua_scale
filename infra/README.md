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

## Cost Guardrails

The dev GKE cluster defaults to one zone through `gke_cluster_location` to avoid accidentally creating a more expensive regional node footprint. Bigtable, BigQuery, Cloud SQL, Redis, and AWS IoT resources are intentionally not created in this first scaffold. Add them only when the implementation needs them and cost controls are clear.
