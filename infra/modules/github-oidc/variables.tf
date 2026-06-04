variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository in owner/name form."
  type        = string
}

variable "artifact_registry_location" {
  description = "Artifact Registry location that contains service repositories."
  type        = string
}

variable "artifact_registry_repository" {
  description = "Artifact Registry repositories that GitHub Actions can push to."
  type        = list(string)
}

variable "pool_id" {
  description = "Workload Identity Pool ID for GitHub Actions."
  type        = string
  default     = "github-actions"
}

variable "provider_id" {
  description = "Workload Identity Pool Provider ID for GitHub Actions."
  type        = string
  default     = "github-actions"
}

variable "service_account_id" {
  description = "Service account ID that GitHub Actions impersonates."
  type        = string
  default     = "aquashield-github-deployer"
}
