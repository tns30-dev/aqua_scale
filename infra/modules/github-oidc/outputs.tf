output "provider_name" {
  description = "Full Workload Identity Provider name for GitHub Actions auth."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "service_account_email" {
  description = "GitHub deployer service account email."
  value       = google_service_account.github_deployer.email
}
