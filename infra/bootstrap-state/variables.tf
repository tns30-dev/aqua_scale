variable "project_id" {
  description = "GCP project ID used to host the Terraform state bucket."
  type        = string
}

variable "region" {
  description = "Default GCP provider region."
  type        = string
  default     = "asia-southeast1"
}

variable "bucket_name" {
  description = "Globally unique GCS bucket name for Terraform state."
  type        = string
}

variable "bucket_location" {
  description = "GCS bucket location for Terraform state."
  type        = string
  default     = "ASIA-SOUTHEAST1"
}
