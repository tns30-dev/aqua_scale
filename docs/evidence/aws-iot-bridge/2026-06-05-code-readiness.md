# AWS IoT/Lambda Bridge Code Readiness - 2026-06-05

## Scope

Prepared the AWS IoT Core to Google Pub/Sub bridge slice without applying live AWS resources.

Added:

- `aws-iot-bridge/` TypeScript Lambda project.
- `infra/modules/aws-iot-bridge/` Terraform module.
- Dev root Terraform wiring behind `enable_aws_iot_bridge = false`.
- GCP Workload Identity Federation design for AWS Lambda to impersonate a publisher-only Google service account.
- Updated `shared-api/events/iot.telemetry.received.v1.json` to match the live ingestion payload shape proven by the managed smoke.

## Bridge Design

Runtime path:

```text
AWS IoT Core topic aquashield/dev/telemetry/{deviceCode}
  -> AWS IoT Topic Rule
  -> Lambda bridge
  -> Google Pub/Sub iot.telemetry.received
  -> Ingestion Service
```

Terraform resources prepared:

```text
AWS:
- aws_iot_thing
- aws_iot_certificate
- aws_iot_policy
- aws_iot_topic_rule
- aws_lambda_function
- aws_iam_role
- aws_cloudwatch_log_group

GCP:
- google_iam_workload_identity_pool
- google_iam_workload_identity_pool_provider
- google_service_account
- google_service_account_iam_member roles/iam.workloadIdentityUser
- google_pubsub_topic_iam_member roles/pubsub.publisher on iot.telemetry.received
```

The Lambda receives AWS IoT Rule JSON, strips rule metadata (`mqtt_topic`, `mqtt_device_code`, `aws_iot_timestamp`), preserves the signed device payload, wraps it in the canonical Pub/Sub envelope, and publishes to Google Pub/Sub through an external-account WIF credential configuration.

## Validation

Lambda package:

```text
npm install
PASS; package-lock created.

npm audit --omit=dev
PASS; found 0 production vulnerabilities.

npm test
PASS; 1 test file, 3 tests.

npm run build
PASS; bundled Node 20 handler with esbuild.

npm run package
PASS; wrote aws-iot-bridge/dist/aws-iot-bridge.zip.
```

Contracts and Terraform:

```text
find shared-api/events -name '*.json' -print0 | xargs -0 -n1 jq empty
PASS.

terraform fmt -recursive infra
PASS; formatted aws-iot-bridge module.

terraform -chdir=infra/environments/dev init -backend=false
PASS; installed local module and hashicorp/aws v6.49.0.

terraform -chdir=infra/environments/dev validate
PASS; configuration is valid.
```

## Live Apply Blocker

AWS CLI is installed, but local AWS credentials are not currently usable:

```text
aws configure get region
<empty>

aws sts get-caller-identity
InvalidClientTokenId: The security token included in the request is invalid.

aws sts get-caller-identity --profile tns_admin
InvalidClientTokenId: The security token included in the request is invalid.
```

No AWS resources were created in this slice. Apply/smoke requires refreshed AWS credentials, a selected AWS region, and the real AWS account ID in ignored `infra/environments/dev/terraform.tfvars`.

## Next Evidence

After AWS auth is fixed:

```text
cd aws-iot-bridge
npm run package

terraform -chdir=infra/environments/dev plan -var-file=terraform.tfvars
terraform -chdir=infra/environments/dev apply -var-file=terraform.tfvars
```

Then capture:

- AWS IoT endpoint.
- Thing/certificate/policy attachment.
- IoT Rule invocation count.
- Lambda CloudWatch log with `eventId` and Pub/Sub `messageId`.
- GCP Pub/Sub pull or ingestion smoke proving `iot.telemetry.received` delivery.
