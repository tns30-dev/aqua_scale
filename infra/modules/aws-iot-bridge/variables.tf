variable "project_id" {
  description = "GCP project ID that owns Pub/Sub and Workload Identity Federation."
  type        = string
}

variable "project_number" {
  description = "GCP project number used in Workload Identity Federation principal names."
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID trusted by the GCP Workload Identity Federation provider."
  type        = string
}

variable "aws_region" {
  description = "AWS region for IoT Core and Lambda."
  type        = string
}

variable "lambda_zip_path" {
  description = "Path to the packaged Lambda zip produced by aws-iot-bridge npm run package."
  type        = string
}

variable "pubsub_topic_name" {
  description = "Existing Google Pub/Sub topic that receives normalized IoT telemetry."
  type        = string
  default     = "iot.telemetry.received"
}

variable "iot_thing_name" {
  description = "Demo AWS IoT thing/device name."
  type        = string
  default     = "aq-dev-simulator-01"
}

variable "iot_topic_prefix" {
  description = "MQTT topic prefix for AquaShield device telemetry."
  type        = string
  default     = "aquashield/dev/telemetry"
}

variable "iot_topic_filter" {
  description = "AWS IoT SQL topic filter routed to the Lambda bridge."
  type        = string
  default     = "aquashield/dev/telemetry/+"
}

variable "lambda_function_name" {
  description = "AWS Lambda function name."
  type        = string
  default     = "aquashield-dev-iot-bridge"
}

variable "lambda_role_name" {
  description = "AWS IAM role name for the Lambda bridge."
  type        = string
  default     = "aquashield-dev-iot-bridge"
}

variable "iot_rule_name" {
  description = "AWS IoT Topic Rule name. AWS IoT rule names must use alphanumeric characters and underscores."
  type        = string
  default     = "aquashield_dev_iot_bridge"
}

variable "gcp_workload_identity_pool_id" {
  description = "GCP Workload Identity Pool ID for AWS bridge identities."
  type        = string
  default     = "aquashield-aws-dev"
}

variable "gcp_workload_identity_provider_id" {
  description = "GCP Workload Identity Pool provider ID for AWS."
  type        = string
  default     = "aws-iot-bridge"
}

variable "gcp_service_account_id" {
  description = "GCP service account ID impersonated by the AWS Lambda bridge."
  type        = string
  default     = "aq-aws-iot-bridge-dev"
}
