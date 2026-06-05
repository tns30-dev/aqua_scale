# AWS IoT Bridge

TypeScript AWS Lambda bridge for the AquaShield AWS IoT Core boundary.

Runtime flow:

```text
Device or simulator
  -> AWS IoT Core MQTT topic aquashield/dev/telemetry/{deviceCode}
  -> AWS IoT Rule
  -> Lambda bridge
  -> Google Pub/Sub topic iot.telemetry.received
  -> Ingestion Service subscription
```

The Lambda uses Google Workload Identity Federation for AWS. It does not use or store a Google service account key. Terraform injects a non-secret external-account credential configuration into the Lambda environment; the handler writes it to `/tmp` and lets the Google Pub/Sub client library exchange the Lambda execution role credentials for short-lived Google credentials.

## Commands

```bash
npm install
npm test
npm run build
npm run package
```

The package command writes `dist/aws-iot-bridge.zip`, which is the value expected by the Terraform variable `aws_iot_lambda_zip_path`.

## Payload Contract

The bridge preserves the signed ingestion payload:

```json
{
  "device_code": "DEV-CLOUD-SMOKE-001",
  "seq_no": 1,
  "measured_at": "2026-06-05T06:00:00Z",
  "ts": 1780639200,
  "sensor_batches": [
    {
      "port": "A1",
      "readings": [
        { "parameter": "ph", "value": 9.2 }
      ]
    }
  ],
  "sig": "hex-hmac"
}
```

AWS IoT Rule metadata such as `mqtt_topic`, `mqtt_device_code`, and `aws_iot_timestamp` is removed before publishing to Pub/Sub so HMAC verification in Ingestion remains stable.
