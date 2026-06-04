resource "google_artifact_registry_repository" "docker" {
  for_each = toset(var.repositories)

  project       = var.project_id
  location      = var.region
  repository_id = each.key
  description   = "AquaShield container images for ${each.key}"
  format        = "DOCKER"
}
