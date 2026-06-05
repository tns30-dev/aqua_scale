# Managed GCP Data And Messaging Slice - Code Readiness

Date: 2026-06-05

## Scope

This evidence records repository readiness for replacing the temporary
in-cluster dev dependencies with managed Google Cloud services:

- Cloud SQL PostgreSQL for service-owned transactional schemas
- Memorystore Redis for authz snapshots, caches, rate limits, and WebSocket state
- Google Pub/Sub topics, subscriptions, retry policy, and DLQ topics
- Cloud Bigtable telemetry table for the target time-series serving layer
- BigQuery bounded analytics dataset and partitioned tables

This is not yet apply evidence. Terraform apply is gated on refreshing
application-default credentials for `aquashieldnus@gmail.com` and reviewing the
managed-service plan/cost impact.

## Terraform Changes

Added:

```text
infra/modules/managed-data/
infra/modules/network private service access support
infra/environments/dev managed data toggles and outputs
```

The committed defaults keep paid managed services disabled:

```hcl
enable_cloud_sql   = false
enable_memorystore = false
enable_pubsub      = false
enable_bigtable    = false
enable_bigquery    = false
```

The local ignored `terraform.tfvars` can enable the evidence slice after budget
and quota review.

## Kubernetes Changes

Added:

```text
k8s/overlays/dev-managed/
```

The overlay inherits the healthy `dev-full` runtime, then:

- prunes the in-cluster Postgres, Redis, and Pub/Sub emulator resources;
- points service `DB_HOST` and Redis settings at Terraform-managed private
  endpoints;
- removes `PUBSUB_EMULATOR_HOST` so Spring Cloud GCP uses real Pub/Sub;
- annotates Kubernetes service accounts for Workload Identity;
- adds a Cloud SQL bootstrap Job for service-user grants and schema ownership.

## Validation

```text
terraform fmt -recursive infra
terraform validate from a backend-free temporary copy of infra/environments/dev
kubectl kustomize k8s/overlays/dev-managed
kubectl apply --dry-run=client -k k8s/overlays/dev-managed
```

Result:

```text
PASS
```

Terraform backend validation is pending because the machine still has stale
application-default credentials for `acceclaim.user@gmail.com`; the active
gcloud CLI account is `aquashieldnus@gmail.com`, but Terraform needs ADC
refreshed before remote-state plan/apply.

## Cutover Gates

Before switching Argo CD from `k8s/overlays/dev-full` to
`k8s/overlays/dev-managed`:

1. Refresh ADC with `gcloud auth application-default login` as
   `aquashieldnus@gmail.com`.
2. Enable the managed-service toggles in local `terraform.tfvars`.
3. Run and review Terraform plan.
4. Apply Terraform.
5. Create `cloudsql-admin-secret` and `managed-db-passwords` in
   `aquashield-dev` from sensitive Terraform outputs.
6. Replace the placeholder Cloud SQL and Memorystore endpoint values in
   `k8s/overlays/dev-managed/managed-runtime-config.yaml`.
7. Switch the Argo CD Application path and capture rollout health evidence.
