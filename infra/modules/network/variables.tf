variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "region" {
  description = "GCP region."
  type        = string
}

variable "network_name" {
  description = "Custom VPC name."
  type        = string
}

variable "subnet_name" {
  description = "GKE subnet name."
  type        = string
}

variable "subnet_cidr" {
  description = "GKE node subnet CIDR."
  type        = string
}

variable "pod_secondary_name" {
  description = "Secondary range name for pods."
  type        = string
}

variable "pod_secondary_cidr" {
  description = "Secondary range CIDR for pods."
  type        = string
}

variable "service_secondary_name" {
  description = "Secondary range name for Kubernetes services."
  type        = string
}

variable "service_secondary_cidr" {
  description = "Secondary range CIDR for Kubernetes services."
  type        = string
}

variable "gke_node_network_tag" {
  description = "Network tag applied to GKE nodes for firewall targeting."
  type        = string
}

variable "enable_cloud_nat" {
  description = "Whether to create Cloud NAT for private node egress."
  type        = bool
  default     = true
}

variable "enable_private_google_access" {
  description = "Whether the subnet should enable Private Google Access."
  type        = bool
  default     = true
}
