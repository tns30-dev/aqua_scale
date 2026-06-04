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
  value       = module.security.cloud_armor_policy_name
}
