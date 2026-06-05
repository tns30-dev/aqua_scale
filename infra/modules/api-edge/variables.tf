variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "address_name" {
  description = "Global static IP address name used by the GKE Gateway."
  type        = string
}

variable "certificate_name" {
  description = "Google-managed SSL certificate resource name used by the GKE Gateway."
  type        = string
}

variable "api_domain" {
  description = "Public API hostname. Leave empty to reserve the IP before DNS is known."
  type        = string
  default     = ""
}
