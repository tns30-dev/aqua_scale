variable "project_id" {
  description = "GCP project ID for the dev environment."
  type        = string
}

variable "region" {
  description = "Primary GCP region."
  type        = string
  default     = "asia-southeast1"
}

variable "gke_cluster_location" {
  description = "GKE cluster location. Use a single zone for the cost-controlled dev cluster."
  type        = string
  default     = "asia-southeast1-a"
}

variable "gke_subnet_cidr" {
  description = "CIDR range for GKE nodes."
  type        = string
  default     = "10.10.0.0/20"
}

variable "pod_secondary_cidr" {
  description = "Secondary CIDR range for GKE pods."
  type        = string
  default     = "10.20.0.0/16"
}

variable "service_secondary_cidr" {
  description = "Secondary CIDR range for Kubernetes services."
  type        = string
  default     = "10.30.0.0/20"
}

variable "master_ipv4_cidr_block" {
  description = "Private control-plane CIDR range for GKE."
  type        = string
  default     = "172.16.0.0/28"
}

variable "node_machine_type" {
  description = "Machine type for the initial dev node pool."
  type        = string
  default     = "e2-standard-2"
}

variable "min_node_count" {
  description = "Minimum autoscaled nodes per zone."
  type        = number
  default     = 1
}

variable "max_node_count" {
  description = "Maximum autoscaled nodes per zone."
  type        = number
  default     = 3
}

variable "github_repository" {
  description = "GitHub repository allowed to impersonate the CI deployer through Workload Identity Federation."
  type        = string
  default     = "tns30-dev/aqua_scale"
}
