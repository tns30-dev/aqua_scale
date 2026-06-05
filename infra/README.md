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
| `modules/managed-data/` | Cloud SQL, Memorystore, Pub/Sub, Bigtable, BigQuery, and runtime Workload Identity bindings |
| `modules/security/` | Cloud Armor policy foundation |
| `modules/aws-iot-bridge/` | AWS IoT Core, Lambda bridge, GCP WIF, and Pub/Sub publisher-only IAM |

## State Flow

1. Run `bootstrap-state/` once with local state to create the GCS state bucket.
2. Copy `environments/dev/backend.tf.example` to `environments/dev/backend.tf`.
3. Replace the backend bucket name.
4. Run `terraform init`, `terraform plan`, and apply only after reviewing cost.

Use `docs/CLOUD_FOUNDATION_SLICE_1.md` for the controlled first cloud slice. Real `terraform.tfvars` files and `environments/*/backend.tf` are local-only and ignored by git.

Current dev state already contains the GCS remote-state bucket, the nine per-service Artifact Registry Docker repositories, the GitHub OIDC/WIF deploy identity, VPC/subnet/NAT/firewall, private-node GKE, Istio, Argo CD, and the full internal dev runtime.

## Cost Guardrails

The dev GKE cluster defaults to one zone through `gke_cluster_location` to avoid accidentally creating a more expensive regional node footprint. Managed data services are behind explicit local toggles:

```hcl
enable_cloud_sql   = false
enable_memorystore = false
enable_pubsub      = false
enable_bigtable    = false
enable_bigquery    = false
enable_aws_iot_bridge = false
```

Turn these on only in ignored local `terraform.tfvars` after reviewing plan cost and quota. Bigtable uses a one-node production instance when enabled because Google Cloud no longer offers new development instances. The AWS IoT/Lambda bridge also requires valid AWS credentials, an AWS account ID, and a packaged Lambda zip.
