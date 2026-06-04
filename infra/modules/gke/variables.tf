variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "location" {
  description = "GKE region or zone. Dev should normally use a single zone for cost control."
  type        = string
}

variable "cluster_name" {
  description = "GKE cluster name."
  type        = string
}

variable "network_self_link" {
  description = "VPC self link."
  type        = string
}

variable "subnetwork_self_link" {
  description = "Subnet self link."
  type        = string
}

variable "pod_secondary_name" {
  description = "Pod secondary range name."
  type        = string
}

variable "service_secondary_name" {
  description = "Service secondary range name."
  type        = string
}

variable "node_pool_name" {
  description = "GKE node pool name."
  type        = string
}

variable "node_machine_type" {
  description = "GKE node machine type."
  type        = string
}

variable "min_node_count" {
  description = "Minimum autoscaled nodes."
  type        = number
}

variable "max_node_count" {
  description = "Maximum autoscaled nodes."
  type        = number
}

variable "gke_node_network_tag" {
  description = "Network tag applied to GKE nodes."
  type        = string
}

variable "master_ipv4_cidr_block" {
  description = "Private control-plane CIDR range."
  type        = string
}

variable "enable_private_nodes" {
  description = "Whether GKE nodes should have private IPs only."
  type        = bool
  default     = true
}

variable "enable_private_endpoint" {
  description = "Whether the GKE control plane endpoint should be private only."
  type        = bool
  default     = false
}
