output "repository_names" {
  description = "Created Artifact Registry repository names."
  value       = [for repo in google_artifact_registry_repository.docker : repo.repository_id]
}
