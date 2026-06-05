# AWS IoT Bridge Terraform Module

Creates the cross-cloud IoT ingress path:

- AWS IoT thing, certificate, publish policy, and topic rule.
- AWS Lambda execution role, log group, and Lambda function.
- GCP Workload Identity Pool/provider trusting the Lambda execution role.
- GCP service account with publisher-only IAM on `iot.telemetry.received`.

The module expects a packaged Lambda zip from:

```bash
cd aws-iot-bridge
npm install
npm run package
```

Use the resulting `aws-iot-bridge/dist/aws-iot-bridge.zip` as `lambda_zip_path`.
