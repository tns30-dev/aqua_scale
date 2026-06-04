# Artifact Registry Apply Evidence

Date: 2026-06-05

## Scope

Created the GCP Artifact Registry cloud prerequisite without applying the rest of the dev foundation.

Included:

- Required project APIs for the current Terraform foundation.
- One Docker repository per implemented service.

Excluded:

- VPC, subnet, Cloud NAT, firewall, Cloud Armor, and GKE resources.
- CI image push, GitHub OIDC/WIF, GitOps manifest update, and Argo CD rollout.

## Target

```text
Project: aerobic-guide-498413-u6
Region: asia-southeast1
Account: aquashieldnus@gmail.com
State bucket: aquashield-aerobic-guide-498413-u6-tfstate
Backend prefix: aqua-scale/dev
```

## Terraform Plan

Command:

```bash
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token --account=aquashieldnus@gmail.com)" \
  terraform -chdir=infra/environments/dev plan \
    -var-file=terraform.tfvars \
    -target=google_project_service.required \
    -target=module.artifact_registry \
    -out=/tmp/aquashield-artifact-registry.tfplan
```

Result:

```text
Plan: 15 to add, 0 to change, 0 to destroy.
```

Planned resources:

- Six `google_project_service.required` API enables:
  - `artifactregistry.googleapis.com`
  - `cloudresourcemanager.googleapis.com`
  - `compute.googleapis.com`
  - `container.googleapis.com`
  - `iamcredentials.googleapis.com`
  - `servicenetworking.googleapis.com`
- Nine `module.artifact_registry.google_artifact_registry_repository.docker` repositories.

## Terraform Apply

Command:

```bash
GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token --account=aquashieldnus@gmail.com)" \
  terraform -chdir=infra/environments/dev apply /tmp/aquashield-artifact-registry.tfplan
```

Result:

```text
Apply complete! Resources: 15 added, 0 changed, 0 destroyed.
```

Terraform output:

```text
artifact_repositories = [
  "analytics-service",
  "audit-service",
  "identity-access-service",
  "ingestion-service",
  "notification-service",
  "pond-service",
  "project-service",
  "realtime-gateway",
  "sensor-service",
]
```

## Repository Verification

Command:

```bash
gcloud artifacts repositories list \
  --project=aerobic-guide-498413-u6 \
  --location=asia-southeast1 \
  --format='table(name,format,location,createTime)'
```

Observed repositories:

| Repository | Format | Location | Create time |
|---|---|---|---|
| `analytics-service` | DOCKER | `asia-southeast1` | `2026-06-05T01:56:02` |
| `audit-service` | DOCKER | `asia-southeast1` | `2026-06-05T01:55:59` |
| `identity-access-service` | DOCKER | `asia-southeast1` | `2026-06-05T01:56:06` |
| `ingestion-service` | DOCKER | `asia-southeast1` | `2026-06-05T01:55:58` |
| `notification-service` | DOCKER | `asia-southeast1` | `2026-06-05T01:56:05` |
| `pond-service` | DOCKER | `asia-southeast1` | `2026-06-05T01:55:59` |
| `project-service` | DOCKER | `asia-southeast1` | `2026-06-05T01:56:03` |
| `realtime-gateway` | DOCKER | `asia-southeast1` | `2026-06-05T01:56:01` |
| `sensor-service` | DOCKER | `asia-southeast1` | `2026-06-05T01:56:01` |

## Terraform State Snapshot

State contains the Artifact Registry slice resources:

```text
google_project_service.required["artifactregistry.googleapis.com"]
google_project_service.required["cloudresourcemanager.googleapis.com"]
google_project_service.required["compute.googleapis.com"]
google_project_service.required["container.googleapis.com"]
google_project_service.required["iamcredentials.googleapis.com"]
google_project_service.required["servicenetworking.googleapis.com"]
module.artifact_registry.google_artifact_registry_repository.docker["analytics-service"]
module.artifact_registry.google_artifact_registry_repository.docker["audit-service"]
module.artifact_registry.google_artifact_registry_repository.docker["identity-access-service"]
module.artifact_registry.google_artifact_registry_repository.docker["ingestion-service"]
module.artifact_registry.google_artifact_registry_repository.docker["notification-service"]
module.artifact_registry.google_artifact_registry_repository.docker["pond-service"]
module.artifact_registry.google_artifact_registry_repository.docker["project-service"]
module.artifact_registry.google_artifact_registry_repository.docker["realtime-gateway"]
module.artifact_registry.google_artifact_registry_repository.docker["sensor-service"]
```

## Remaining Foundation Plan

After the Artifact Registry apply, a full dev plan succeeds with:

```text
Plan: 9 to add, 0 to change, 0 to destroy.
```

Remaining resources:

- `module.gke.google_container_cluster.this`
- `module.gke.google_container_node_pool.primary`
- `module.network.google_compute_firewall.allow_gclb_health_checks`
- `module.network.google_compute_firewall.allow_internal`
- `module.network.google_compute_network.this`
- `module.network.google_compute_router.this[0]`
- `module.network.google_compute_router_nat.this[0]`
- `module.network.google_compute_subnetwork.gke`
- `module.security.google_compute_security_policy.api_edge`

## Next Test

Either:

- Configure GitHub OIDC/WIF and prove one Git-SHA-tagged image push to a repository.
- Apply the remaining foundation plan when the GKE/network cost surface is accepted.
