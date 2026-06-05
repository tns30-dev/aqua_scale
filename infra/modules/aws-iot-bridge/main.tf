terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

locals {
  lambda_role_arn_prefix = "arn:aws:sts::${var.aws_account_id}:assumed-role/${var.lambda_role_name}/"
  wif_audience           = "//iam.googleapis.com/projects/${var.project_number}/locations/global/workloadIdentityPools/${var.gcp_workload_identity_pool_id}/providers/${var.gcp_workload_identity_provider_id}"
  credential_config = {
    type                              = "external_account"
    audience                          = local.wif_audience
    subject_token_type                = "urn:ietf:params:aws:token-type:aws4_request"
    token_url                         = "https://sts.googleapis.com/v1/token"
    service_account_impersonation_url = "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${google_service_account.lambda_bridge.email}:generateAccessToken"
    credential_source = {
      environment_id                 = "aws1"
      region_url                     = "http://169.254.169.254/latest/meta-data/placement/availability-zone"
      url                            = "http://169.254.169.254/latest/meta-data/iam/security-credentials"
      regional_cred_verification_url = "https://sts.{region}.amazonaws.com?Action=GetCallerIdentity&Version=2011-06-15"
    }
  }
}

resource "google_service_account" "lambda_bridge" {
  project      = var.project_id
  account_id   = var.gcp_service_account_id
  display_name = "AquaShield AWS IoT Lambda bridge"
  description  = "Impersonated by AWS Lambda through Workload Identity Federation to publish iot.telemetry.received."
}

resource "google_iam_workload_identity_pool" "aws" {
  project                   = var.project_id
  workload_identity_pool_id = var.gcp_workload_identity_pool_id
  display_name              = "AquaShield AWS dev"
  description               = "Trust boundary for AWS Lambda bridge identities."
}

resource "google_iam_workload_identity_pool_provider" "aws" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.aws.workload_identity_pool_id
  workload_identity_pool_provider_id = var.gcp_workload_identity_provider_id
  display_name                       = "AWS IoT Lambda bridge"
  description                        = "Accepts the AquaShield Lambda execution role from AWS account ${var.aws_account_id}."

  attribute_mapping = {
    "google.subject"     = "assertion.arn"
    "attribute.account"  = "assertion.account"
    "attribute.aws_role" = "assertion.arn.extract('assumed-role/{role_name}/')"
  }

  attribute_condition = "assertion.arn.startsWith('${local.lambda_role_arn_prefix}')"

  aws {
    account_id = var.aws_account_id
  }
}

resource "google_service_account_iam_member" "lambda_bridge_wif_user" {
  service_account_id = google_service_account.lambda_bridge.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.aws.name}/attribute.aws_role/${var.lambda_role_name}"
}

resource "google_pubsub_topic_iam_member" "lambda_bridge_publisher" {
  project = var.project_id
  topic   = var.pubsub_topic_name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.lambda_bridge.email}"
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.lambda_function_name}"
  retention_in_days = 14
}

resource "aws_iam_role" "lambda" {
  name = var.lambda_role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_logs" {
  name = "${var.lambda_role_name}-logs"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.lambda.arn}:*"
      }
    ]
  })
}

resource "aws_lambda_function" "bridge" {
  function_name    = var.lambda_function_name
  role             = aws_iam_role.lambda.arn
  handler          = "handler.handler"
  runtime          = "nodejs20.x"
  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      EVENT_SOURCE                             = "aws-iot-lambda-bridge"
      GCP_PROJECT_ID                           = var.project_id
      GOOGLE_EXTERNAL_ACCOUNT_CREDENTIALS_JSON = jsonencode(local.credential_config)
      PUBSUB_TOPIC                             = var.pubsub_topic_name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda,
    aws_iam_role_policy.lambda_logs,
    google_service_account_iam_member.lambda_bridge_wif_user,
    google_pubsub_topic_iam_member.lambda_bridge_publisher
  ]
}

resource "aws_lambda_permission" "allow_iot_rule" {
  statement_id  = "AllowExecutionFromIoTRule"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.bridge.function_name
  principal     = "iot.amazonaws.com"
  source_arn    = aws_iot_topic_rule.telemetry.arn
}

resource "aws_iot_thing" "device" {
  name = var.iot_thing_name
}

resource "aws_iot_certificate" "device" {
  active = true
}

resource "aws_iot_policy" "device" {
  name = "${var.iot_thing_name}-telemetry-publish"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "iot:Connect"
        Resource = "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:client/$${iot:Connection.Thing.ThingName}"
      },
      {
        Effect   = "Allow"
        Action   = "iot:Publish"
        Resource = "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topic/${var.iot_topic_prefix}/$${iot:Connection.Thing.ThingName}"
      }
    ]
  })
}

resource "aws_iot_policy_attachment" "device" {
  policy = aws_iot_policy.device.name
  target = aws_iot_certificate.device.arn
}

resource "aws_iot_thing_principal_attachment" "device" {
  principal = aws_iot_certificate.device.arn
  thing     = aws_iot_thing.device.name
}

resource "aws_iot_topic_rule" "telemetry" {
  name        = var.iot_rule_name
  description = "Route AquaShield telemetry from AWS IoT Core to the Google Pub/Sub bridge Lambda."
  enabled     = true
  sql         = "SELECT *, topic() AS mqtt_topic, topic(4) AS mqtt_device_code, timestamp() AS aws_iot_timestamp FROM '${var.iot_topic_filter}'"
  sql_version = "2016-03-23"

  lambda {
    function_arn = aws_lambda_function.bridge.arn
  }
}
