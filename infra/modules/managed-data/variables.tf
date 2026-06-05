variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "project_number" {
  description = "Numeric GCP project number, used for managed service agents."
  type        = string
}

variable "region" {
  description = "Primary GCP region."
  type        = string
}

variable "network_self_link" {
  description = "VPC self link used by private Cloud SQL and Memorystore."
  type        = string
}

variable "kubernetes_namespace" {
  description = "Kubernetes namespace containing AquaShield service accounts."
  type        = string
  default     = "aquashield-dev"
}

variable "enable_cloud_sql" {
  description = "Create Cloud SQL PostgreSQL for transactional service schemas."
  type        = bool
  default     = false
}

variable "enable_memorystore" {
  description = "Create Memorystore Redis for cache, authz snapshots, rate limits, and WSS fanout state."
  type        = bool
  default     = false
}

variable "enable_pubsub" {
  description = "Create the Google Pub/Sub event catalogue with DLQ topics and subscriptions."
  type        = bool
  default     = false
}

variable "enable_bigtable" {
  description = "Create Cloud Bigtable for the target telemetry time-series store. Bigtable has provisioned-node cost, so keep this off unless evidence is needed."
  type        = bool
  default     = false
}

variable "enable_bigquery" {
  description = "Create BigQuery dataset and tables for bounded historical analytics evidence."
  type        = bool
  default     = false
}

variable "cloud_sql_instance_name" {
  description = "Cloud SQL PostgreSQL instance name."
  type        = string
  default     = "aquashield-dev-postgres"
}

variable "cloud_sql_database_name" {
  description = "Cloud SQL database name used by service-owned schemas."
  type        = string
  default     = "aquashield"
}

variable "cloud_sql_tier" {
  description = "Cloud SQL machine tier. Shared-core is enough for dev evidence."
  type        = string
  default     = "db-f1-micro"
}

variable "cloud_sql_disk_gb" {
  description = "Initial Cloud SQL disk size in GB."
  type        = number
  default     = 10
}

variable "cloud_sql_deletion_protection" {
  description = "Prevent accidental Cloud SQL deletion. Keep false for short-lived student evidence environments."
  type        = bool
  default     = false
}

variable "redis_instance_name" {
  description = "Memorystore Redis instance name."
  type        = string
  default     = "aquashield-dev-redis"
}

variable "redis_memory_size_gb" {
  description = "Memorystore Redis memory size in GB."
  type        = number
  default     = 1
}

variable "bigtable_instance_name" {
  description = "Cloud Bigtable instance ID."
  type        = string
  default     = "aquashield-dev-telemetry"
}

variable "bigtable_cluster_id" {
  description = "Cloud Bigtable cluster ID."
  type        = string
  default     = "dev-sg-a"
}

variable "bigtable_zone" {
  description = "Cloud Bigtable cluster zone."
  type        = string
  default     = "asia-southeast1-a"
}

variable "bigtable_num_nodes" {
  description = "Number of Cloud Bigtable nodes. Minimum production evidence footprint is one node."
  type        = number
  default     = 1
}

variable "bigtable_deletion_protection" {
  description = "Prevent accidental Bigtable deletion. Keep false for short-lived student evidence environments."
  type        = bool
  default     = false
}

variable "bigquery_dataset_id" {
  description = "BigQuery dataset ID for analytical facts."
  type        = string
  default     = "aquashield_dev_analytics"
}

variable "bigquery_location" {
  description = "BigQuery dataset location."
  type        = string
  default     = "asia-southeast1"
}
