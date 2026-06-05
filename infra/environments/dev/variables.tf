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
  default     = 2
}

variable "enable_cloud_armor" {
  description = "Create the Cloud Armor edge policy. Keep false in projects with zero Cloud Armor quota."
  type        = bool
  default     = false
}

variable "enable_cloud_sql" {
  description = "Create managed Cloud SQL PostgreSQL for service-owned transactional schemas."
  type        = bool
  default     = false
}

variable "enable_memorystore" {
  description = "Create managed Memorystore Redis for cache, authz snapshots, rate limits, and realtime fanout state."
  type        = bool
  default     = false
}

variable "enable_pubsub" {
  description = "Create real Google Pub/Sub topics, subscriptions, and DLQs."
  type        = bool
  default     = false
}

variable "enable_bigtable" {
  description = "Create Cloud Bigtable telemetry store. This has provisioned-node cost; enable only for short evidence windows."
  type        = bool
  default     = false
}

variable "enable_bigquery" {
  description = "Create BigQuery bounded analytics dataset and tables."
  type        = bool
  default     = false
}

variable "cloud_sql_tier" {
  description = "Cloud SQL PostgreSQL machine tier for dev evidence."
  type        = string
  default     = "db-f1-micro"
}

variable "cloud_sql_deletion_protection" {
  description = "Prevent accidental Cloud SQL deletion. Keep false for short-lived student evidence environments."
  type        = bool
  default     = false
}

variable "redis_memory_size_gb" {
  description = "Memorystore Redis size for dev evidence."
  type        = number
  default     = 1
}

variable "bigtable_num_nodes" {
  description = "Cloud Bigtable node count for the dev telemetry instance."
  type        = number
  default     = 1
}

variable "bigtable_deletion_protection" {
  description = "Prevent accidental Bigtable deletion. Keep false for short-lived student evidence environments."
  type        = bool
  default     = false
}

variable "github_repository" {
  description = "GitHub repository allowed to impersonate the CI deployer through Workload Identity Federation."
  type        = string
  default     = "tns30-dev/aqua_scale"
}

variable "enable_aws_iot_bridge" {
  description = "Create AWS IoT Core, Lambda bridge, and GCP WIF resources for IoT telemetry ingress."
  type        = bool
  default     = false
}

variable "aws_region" {
  description = "AWS region for IoT Core and Lambda bridge resources."
  type        = string
  default     = "ap-southeast-1"
}

variable "aws_profile" {
  description = "Optional local AWS CLI profile for Terraform applies."
  type        = string
  default     = null
}

variable "aws_account_id" {
  description = "AWS account ID trusted by GCP Workload Identity Federation for the Lambda bridge."
  type        = string
  default     = ""
}

variable "aws_iot_lambda_zip_path" {
  description = "Optional absolute path to the packaged aws-iot-bridge Lambda zip."
  type        = string
  default     = ""
}

variable "aws_iot_thing_name" {
  description = "AWS IoT demo thing/device name."
  type        = string
  default     = "aq-dev-simulator-01"
}

variable "aws_iot_topic_prefix" {
  description = "MQTT topic prefix for AquaShield telemetry."
  type        = string
  default     = "aquashield/dev/telemetry"
}

variable "aws_iot_topic_filter" {
  description = "AWS IoT SQL topic filter routed to Lambda."
  type        = string
  default     = "aquashield/dev/telemetry/+"
}
