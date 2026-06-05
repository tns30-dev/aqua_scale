# Managed GCP Data Apply Evidence - 2026-06-05

## Scope

Applied the managed data and messaging slice in GCP project `aerobic-guide-498413-u6`, region `asia-southeast1`.

Created resources:

- Cloud SQL PostgreSQL 16 private-IP instance for service-owned schemas.
- Memorystore Redis private endpoint.
- Google Pub/Sub event catalogue with DLQ topics and subscriptions.
- Cloud Bigtable telemetry instance/table.
- BigQuery bounded analytics dataset/tables.
- Runtime Google service accounts and Workload Identity IAM bindings.

## Terraform Apply

Initial full apply created private service access, Pub/Sub, Bigtable, BigQuery, Memorystore, runtime service accounts, and IAM bindings, then failed on Cloud SQL because the API defaulted the instance to `ENTERPRISE_PLUS` while the dev tier was `db-f1-micro`.

Fix applied:

```hcl
settings {
  tier    = var.cloud_sql_tier
  edition = "ENTERPRISE"
}
```

Retry plan:

```text
Plan: 10 to add, 0 to change, 0 to destroy.
```

Retry apply:

```text
Apply complete! Resources: 10 added, 0 changed, 0 destroyed.
```

Node-pool autoscaling was temporarily raised from `2` to `3` while debugging pod scheduling, but GCP free-credit quota rejected the extra SSD-backed node:

```text
Quota 'SSD_TOTAL_GB' exceeded. Limit: 250.0 in region asia-southeast1.
```

After the GitOps annotation fix restored small Istio proxy requests, all workloads fit on the existing two nodes. Terraform was restored to:

```text
max_node_count: 3 -> 2
Apply complete! Resources: 0 added, 1 changed, 0 destroyed.
```

## Live Resource Proof

Cloud SQL:

```text
aquashield-dev-postgres  asia-southeast1  POSTGRES_16  db-f1-micro  ENTERPRISE  10.128.1.3
```

Memorystore:

```text
aquashield-dev-redis  10.128.0.3  6379  asia-southeast1-c  READY  REDIS_7_0
```

Pub/Sub:

```text
topics:        36
subscriptions: 45
```

Bigtable:

```text
aquashield-dev-telemetry  AquaShield dev telemetry  READY
```

BigQuery:

```text
dataset: aquashield_dev_analytics
tables:  readings, alerts
```

## Runtime Endpoint Outputs

Terraform outputs used by the Kubernetes managed overlay:

```text
cloud_sql_connection_name    = aerobic-guide-498413-u6:asia-southeast1:aquashield-dev-postgres
cloud_sql_database_name      = aquashield
cloud_sql_private_ip_address = 10.128.1.3
memorystore_host             = 10.128.0.3
memorystore_port             = 6379
bigtable_instance_name       = aquashield-dev-telemetry
bigtable_table_name          = telemetry_readings
bigquery_dataset_id          = aquashield_dev_analytics
```

Sensitive Terraform outputs were not committed. They were used locally to create:

- `cloudsql-admin-secret`
- `managed-db-passwords`

## Bootstrap Proof

Cloud SQL bootstrap job completed from inside `aquashield-dev`:

```text
10.128.1.3:5432 - accepting connections
...
Cloud SQL schema bootstrap complete.
```

The bootstrap creates/updates service users and service-owned schemas:

- `identity_access`
- `project`
- `pond`
- `sensor`
- `ingestion`
- `notification`
- `audit`

## Notes

Bigtable and BigQuery infrastructure is live for the target architecture. The current service code still uses the implemented Postgres-backed telemetry/read seams where that wiring has not yet been replaced by native Bigtable/BigQuery repositories.
