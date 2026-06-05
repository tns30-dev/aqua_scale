output "lambda_function_name" {
  description = "AWS Lambda bridge function name."
  value       = aws_lambda_function.bridge.function_name
}

output "lambda_function_arn" {
  description = "AWS Lambda bridge function ARN."
  value       = aws_lambda_function.bridge.arn
}

output "iot_rule_name" {
  description = "AWS IoT Topic Rule name."
  value       = aws_iot_topic_rule.telemetry.name
}

output "iot_thing_name" {
  description = "AWS IoT demo thing name."
  value       = aws_iot_thing.device.name
}

output "iot_certificate_arn" {
  description = "AWS IoT demo certificate ARN."
  value       = aws_iot_certificate.device.arn
}

output "iot_certificate_pem" {
  description = "AWS IoT demo certificate PEM. Store outside git before using a simulator."
  value       = aws_iot_certificate.device.certificate_pem
  sensitive   = true
}

output "iot_private_key" {
  description = "AWS IoT demo certificate private key. Store outside git before using a simulator."
  value       = aws_iot_certificate.device.private_key
  sensitive   = true
}

output "gcp_bridge_service_account_email" {
  description = "GCP service account impersonated by AWS Lambda through WIF."
  value       = google_service_account.lambda_bridge.email
}

output "gcp_workload_identity_provider" {
  description = "GCP Workload Identity Federation provider resource name."
  value       = google_iam_workload_identity_pool_provider.aws.name
}

output "gcp_workload_identity_audience" {
  description = "External account audience used by Google auth libraries."
  value       = local.wif_audience
}
