variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "region" {
  description = "Artifact Registry region."
  type        = string
}

variable "repositories" {
  description = "Docker repositories to create."
  type        = list(string)
}
