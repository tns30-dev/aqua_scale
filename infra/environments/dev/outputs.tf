output "network_name" {
  description = "Created VPC name."
  value       = module.network.network_name
}

output "subnet_name" {
  description = "Created GKE subnet name."
  value       = module.network.subnetwork_name
}

output "cluster_name" {
  description = "Created GKE cluster name."
  value       = module.gke.cluster_name
}

output "artifact_repositories" {
  description = "Artifact Registry repositories for service images."
  value       = module.artifact_registry.repository_names
}

output "github_deployer_service_account" {
  description = "Service account that GitHub Actions impersonates through Workload Identity Federation."
  value       = module.github_oidc.service_account_email
}

output "github_workload_identity_provider" {
  description = "Workload Identity provider resource name for google-github-actions/auth."
  value       = module.github_oidc.provider_name
}

output "cloud_armor_policy_name" {
  description = "Cloud Armor policy for the API edge."
  value       = var.enable_cloud_armor ? module.security[0].cloud_armor_policy_name : null
}

output "api_edge_address_name" {
  description = "Global static IP address name for the public API Gateway."
  value       = var.enable_public_api_edge ? module.api_edge[0].address_name : null
}

output "api_edge_address" {
  description = "Global static IPv4 address for the public API Gateway."
  value       = var.enable_public_api_edge ? module.api_edge[0].address : null
}

output "api_edge_certificate_name" {
  description = "Google-managed SSL certificate name for the public API Gateway."
  value       = var.enable_public_api_edge ? module.api_edge[0].certificate_name : null
}

output "api_edge_certificate_domains" {
  description = "Domains requested for the public API Gateway certificate."
  value       = var.enable_public_api_edge ? module.api_edge[0].certificate_domains : []
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL instance connection name for Cloud SQL Auth Proxy."
  value       = module.managed_data.cloud_sql_connection_name
}

output "cloud_sql_private_ip_address" {
  description = "Cloud SQL private IP address."
  value       = module.managed_data.cloud_sql_private_ip_address
}

output "cloud_sql_database_name" {
  description = "Cloud SQL database name."
  value       = module.managed_data.cloud_sql_database_name
}

output "cloud_sql_admin_password" {
  description = "Generated Cloud SQL postgres admin password."
  value       = module.managed_data.cloud_sql_admin_password
  sensitive   = true
}

output "cloud_sql_service_passwords" {
  description = "Generated Cloud SQL service-user passwords."
  value       = module.managed_data.cloud_sql_service_passwords
  sensitive   = true
}

output "memorystore_host" {
  description = "Memorystore Redis private host."
  value       = module.managed_data.memorystore_host
}

output "memorystore_port" {
  description = "Memorystore Redis port."
  value       = module.managed_data.memorystore_port
}

output "pubsub_topic_names" {
  description = "Pub/Sub topic names managed by Terraform."
  value       = module.managed_data.pubsub_topic_names
}

output "pubsub_subscription_names" {
  description = "Pub/Sub subscription names managed by Terraform."
  value       = module.managed_data.pubsub_subscription_names
}

output "bigtable_instance_name" {
  description = "Cloud Bigtable instance name."
  value       = module.managed_data.bigtable_instance_name
}

output "bigtable_table_name" {
  description = "Cloud Bigtable telemetry table name."
  value       = module.managed_data.bigtable_table_name
}

output "bigquery_dataset_id" {
  description = "BigQuery dataset ID."
  value       = module.managed_data.bigquery_dataset_id
}

output "bigquery_table_ids" {
  description = "BigQuery table IDs."
  value       = module.managed_data.bigquery_table_ids
}

output "runtime_service_account_emails" {
  description = "GCP runtime service accounts bound to Kubernetes service accounts."
  value       = module.managed_data.runtime_service_account_emails
}

output "aws_iot_bridge_lambda_function_name" {
  description = "AWS Lambda bridge function name."
  value       = var.enable_aws_iot_bridge ? module.aws_iot_bridge[0].lambda_function_name : null
}

output "aws_iot_bridge_rule_name" {
  description = "AWS IoT topic rule name."
  value       = var.enable_aws_iot_bridge ? module.aws_iot_bridge[0].iot_rule_name : null
}

output "aws_iot_bridge_thing_name" {
  description = "AWS IoT demo thing name."
  value       = var.enable_aws_iot_bridge ? module.aws_iot_bridge[0].iot_thing_name : null
}

output "aws_iot_bridge_gcp_service_account_email" {
  description = "GCP service account impersonated by the AWS Lambda bridge."
  value       = var.enable_aws_iot_bridge ? module.aws_iot_bridge[0].gcp_bridge_service_account_email : null
}

output "aws_iot_bridge_wif_provider" {
  description = "GCP WIF provider for the AWS Lambda bridge."
  value       = var.enable_aws_iot_bridge ? module.aws_iot_bridge[0].gcp_workload_identity_provider : null
}

output "aws_iot_bridge_certificate_pem" {
  description = "AWS IoT demo certificate PEM. Store outside git before using a simulator."
  value       = var.enable_aws_iot_bridge ? module.aws_iot_bridge[0].iot_certificate_pem : null
  sensitive   = true
}

output "aws_iot_bridge_private_key" {
  description = "AWS IoT demo private key. Store outside git before using a simulator."
  value       = var.enable_aws_iot_bridge ? module.aws_iot_bridge[0].iot_private_key : null
  sensitive   = true
}
