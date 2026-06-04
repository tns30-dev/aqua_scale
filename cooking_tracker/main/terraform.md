# Terraform Infrastructure Checklist

## Target

| Item | Selection |
|---|---|
| IaC tool | Terraform |
| State backend | Google Cloud Storage bucket |
| Cloud target | GCP primary, AWS IoT boundary |
| Execution | Local development first; CI plan/apply if time allows |
| Auth | Developer ADC locally; GitHub OIDC/WIF for CI if automated |

## Remote State Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Create GCS bucket for Terraform state | Remote state bucket |
| [ ] | Enable bucket versioning | Recoverable state history |
| [ ] | Enable uniform bucket-level access | Consistent IAM model |
| [ ] | Restrict bucket IAM | Only Terraform operators/CI can read/write state |
| [ ] | Enable encryption | Google-managed or CMEK if required |
| [ ] | Configure Terraform `gcs` backend | State stored in Google bucket |
| [ ] | Use environment-specific state prefixes | Separate `dev`, `staging`, optional `prod` state |
| [ ] | Document state bucket name and prefix | Repeatable setup |

## Resource Checklist

| Status | Resource Group | Output |
|---|---|---|
| [ ] | GCP project APIs | Required services enabled |
| [ ] | Custom VPC and subnet | Network foundation |
| [ ] | GKE cluster and node pools | Kubernetes platform |
| [ ] | Artifact Registry | Container image repositories |
| [ ] | Cloud SQL PostgreSQL | Primary and optional read replica |
| [ ] | Memorystore Redis | Authz snapshot/cache/fanout store |
| [ ] | Pub/Sub topics and subscriptions | Event bus with DLQs |
| [ ] | Cloud Storage buckets | Reports/artifacts/archives |
| [ ] | Bigtable target resources | Cost-controlled telemetry target |
| [ ] | BigQuery dataset | Bounded analytics dataset |
| [ ] | IAM service accounts | Least-privilege workload identities |
| [ ] | Cloud Armor policy | WAF and rate limits |
| [ ] | AWS IoT Core resources | Things, certificates, policies, rules if automated |
| [ ] | AWS Lambda bridge resources | IoT-to-Pub/Sub bridge if automated |

## Module Checklist

| Status | Module | Purpose |
|---|---|---|
| [ ] | `modules/network` | VPC, subnet, secondary ranges, NAT, private access |
| [ ] | `modules/gke` | GKE cluster, node pools, workload identity |
| [ ] | `modules/security` | Cloud Armor, firewall, IAM bindings |
| [ ] | `modules/data` | Cloud SQL, Redis, Bigtable, BigQuery, Storage |
| [ ] | `modules/pubsub` | Topics, subscriptions, schemas, DLQs |
| [ ] | `modules/artifact-registry` | Container repositories |
| [ ] | `modules/aws-iot` | AWS IoT and Lambda bridge resources if time allows |

## Workflow Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Run `terraform fmt` | Consistent formatting |
| [ ] | Run `terraform validate` | Config is valid |
| [ ] | Run `terraform plan` | Change preview |
| [ ] | Review plan before apply | No accidental expensive resources |
| [ ] | Run `terraform apply` for selected environment | Infrastructure created |
| [ ] | Store plan/apply output | Evidence for report |
| [ ] | Use variables for cost-sensitive resources | Bigtable/BigQuery demo scope controlled |
| [ ] | Keep secrets out of Terraform state where possible | Sensitive values managed safely |

## Evidence Checklist

| Status | Evidence | Expected Result |
|---|---|---|
| [ ] | GCS backend bucket screenshot | Terraform state bucket visible |
| [ ] | Terraform backend config | `gcs` backend configured |
| [ ] | State object screenshot | `.tfstate` stored in bucket prefix |
| [ ] | Terraform plan output | Infrastructure changes visible |
| [ ] | Terraform apply output | Selected resources created |
| [ ] | Cloud Console screenshots | Provisioned resources visible |

## Considerations

| Topic | Guidance |
|---|---|
| State storage | Store Terraform state in a Google Cloud Storage bucket, not local files, once cloud provisioning begins. |
| State safety | Enable bucket versioning and restrict IAM because Terraform state can contain sensitive infrastructure data. |
| Cost control | Keep Bigtable and BigQuery resources bounded for demo evidence. Do not create expensive replication unless explicitly required. |
| CI automation | If CI-based Terraform is implemented, use GitHub OIDC/WIF and run plan on PR, apply only after approval. |
| AWS resources | AWS IoT/Lambda can be Terraform-managed if time allows; otherwise document manual setup with screenshots. |
