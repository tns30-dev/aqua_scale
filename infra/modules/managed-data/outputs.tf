output "cloud_sql_instance_name" {
  description = "Cloud SQL instance name."
  value       = var.enable_cloud_sql ? google_sql_database_instance.postgres[0].name : null
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL instance connection name for the Cloud SQL Auth Proxy."
  value       = var.enable_cloud_sql ? google_sql_database_instance.postgres[0].connection_name : null
}

output "cloud_sql_private_ip_address" {
  description = "Cloud SQL private IP address."
  value       = var.enable_cloud_sql ? google_sql_database_instance.postgres[0].private_ip_address : null
}

output "cloud_sql_database_name" {
  description = "Cloud SQL database name."
  value       = var.enable_cloud_sql ? google_sql_database.aquashield[0].name : null
}

output "cloud_sql_admin_password" {
  description = "Generated password for the Cloud SQL postgres admin user."
  value       = var.enable_cloud_sql ? random_password.postgres_admin[0].result : null
  sensitive   = true
}

output "cloud_sql_service_passwords" {
  description = "Generated database passwords keyed by service schema key."
  value = var.enable_cloud_sql ? {
    for key, password in random_password.postgres_service_user : key => password.result
  } : {}
  sensitive = true
}

output "memorystore_host" {
  description = "Memorystore Redis private host."
  value       = var.enable_memorystore ? google_redis_instance.redis[0].host : null
}

output "memorystore_port" {
  description = "Memorystore Redis port."
  value       = var.enable_memorystore ? google_redis_instance.redis[0].port : null
}

output "pubsub_topic_names" {
  description = "Pub/Sub topic names, including DLQ topics."
  value       = var.enable_pubsub ? sort(keys(google_pubsub_topic.topic)) : []
}

output "pubsub_subscription_names" {
  description = "Pub/Sub subscription names."
  value       = var.enable_pubsub ? sort(keys(google_pubsub_subscription.subscription)) : []
}

output "bigtable_instance_name" {
  description = "Cloud Bigtable telemetry instance ID."
  value       = var.enable_bigtable ? google_bigtable_instance.telemetry[0].name : null
}

output "bigtable_table_name" {
  description = "Cloud Bigtable telemetry table name."
  value       = var.enable_bigtable ? google_bigtable_table.telemetry_readings[0].name : null
}

output "bigquery_dataset_id" {
  description = "BigQuery analytics dataset ID."
  value       = var.enable_bigquery ? google_bigquery_dataset.analytics[0].dataset_id : null
}

output "bigquery_table_ids" {
  description = "BigQuery table IDs."
  value = var.enable_bigquery ? [
    google_bigquery_table.readings[0].table_id,
    google_bigquery_table.alerts[0].table_id
  ] : []
}

output "runtime_service_account_emails" {
  description = "GCP runtime service accounts bound to Kubernetes service accounts through Workload Identity."
  value = {
    for key, service_account in google_service_account.runtime : key => service_account.email
  }
}
