# AWS IoT Bridge Live Deploy And Smoke

Date: 2026-06-05

## Scope

Deployed the AWS IoT Core and AWS Lambda bridge slice, then proved the real cross-cloud telemetry path:

AWS IoT Core MQTT over x.509 -> IoT Rule -> AWS Lambda bridge -> Google Workload Identity Federation -> Google Pub/Sub `iot.telemetry.received` -> managed GKE ingestion/read models.

## Terraform Apply

Local ignored input file:

- `infra/environments/dev/terraform.tfvars`
- `enable_aws_iot_bridge = true`
- `aws_profile = "aquashield"`
- `aws_region = "ap-southeast-1"`
- `aws_account_id = "342327769401"`

Command:

```bash
terraform -chdir=infra/environments/dev apply -var-file=terraform.tfvars -auto-approve
```

Result:

```text
Apply complete! Resources: 16 added, 0 changed, 0 destroyed.
```

Created bridge outputs:

```text
aws_iot_bridge_lambda_function_name      = "aquashield-dev-iot-bridge"
aws_iot_bridge_rule_name                 = "aquashield_dev_iot_bridge"
aws_iot_bridge_thing_name                = "aq-dev-simulator-01"
aws_iot_bridge_gcp_service_account_email = "aq-aws-iot-bridge-dev@aerobic-guide-498413-u6.iam.gserviceaccount.com"
aws_iot_bridge_wif_provider              = "projects/294489509399/locations/global/workloadIdentityPools/aquashield-aws-dev/providers/aws-iot-bridge"
```

Sensitive Terraform outputs for the IoT certificate and private key were written only to ignored local files under `local/dev-keys/` for smoke testing. They were not committed.

## AWS Evidence

IoT thing:

```text
thingName: aq-dev-simulator-01
defaultClientId: aq-dev-simulator-01
thingArn: arn:aws:iot:ap-southeast-1:342327769401:thing/aq-dev-simulator-01
```

IoT rule:

```text
ruleName: aquashield_dev_iot_bridge
sql: SELECT *, topic() AS mqtt_topic, topic(4) AS mqtt_device_code, timestamp() AS aws_iot_timestamp FROM 'aquashield/dev/telemetry/+'
ruleDisabled: false
lambda: arn:aws:lambda:ap-southeast-1:342327769401:function:aquashield-dev-iot-bridge
```

Lambda:

```text
FunctionName: aquashield-dev-iot-bridge
Runtime: nodejs20.x
Role: arn:aws:iam::342327769401:role/aquashield-dev-iot-bridge
Handler: handler.handler
State: Active
LastUpdateStatus: Successful
PUBSUB_TOPIC: iot.telemetry.received
GCP_PROJECT_ID: aerobic-guide-498413-u6
```

## GCP IAM Evidence

Workload Identity Federation provider:

```text
name: projects/294489509399/locations/global/workloadIdentityPools/aquashield-aws-dev/providers/aws-iot-bridge
state: ACTIVE
aws.accountId: 342327769401
attributeCondition: assertion.arn.startsWith('arn:aws:sts::342327769401:assumed-role/aquashield-dev-iot-bridge/')
```

Pub/Sub topic IAM:

```text
roles/pubsub.publisher:
  serviceAccount:aq-aws-iot-bridge-dev@aerobic-guide-498413-u6.iam.gserviceaccount.com
```

No Google service account JSON key is used by the Lambda. The bridge uses AWS runtime credentials through GCP Workload Identity Federation and impersonates only the publisher service account.

## Smoke Command

The managed business-flow smoke was reused with AWS IoT as the publisher:

```bash
SMOKE_PUBLISHER=aws_iot \
SMOKE_DEVICE_CODE=aq-dev-simulator-01 \
SMOKE_DEVICE_KEY=<generated HMAC key> \
SMOKE_PORT_A=A150110 \
SMOKE_PORT_B=B150110 \
PUBSUB_PROJECT_ID=aerobic-guide-498413-u6 \
AWS_IOT_ENDPOINT=a367weo81yugpz-ats.iot.ap-southeast-1.amazonaws.com \
AWS_IOT_CERT_PATH=local/dev-keys/aws-iot-device.pem \
AWS_IOT_KEY_PATH=local/dev-keys/aws-iot-device.key \
AWS_IOT_CA_PATH=local/dev-keys/AmazonRootCA1.pem \
SMOKE_SUMMARY_PATH=/private/tmp/aq-aws-iot-smoke-summary.json \
python3 scripts/smoke-managed-business-flow.py
```

The script used `mosquitto_pub` over MQTT/TLS port `8883` with the generated IoT certificate.

## Smoke Result

```json
{
  "activeAlerts": 1,
  "auditSecurityRows": 4,
  "comparisonMetricCount": 4,
  "deviceCode": "aq-dev-simulator-01",
  "energyTotalKwh": 3.1,
  "mqttTopic": "aquashield/dev/telemetry/aq-dev-simulator-01",
  "ports": {
    "alpha": "A150110",
    "beta": "B150110"
  },
  "projectId": "85d64003-c4dd-4081-aa9f-d0a9f4270f43",
  "publisher": "aws_iot",
  "pubsubProject": "aerobic-guide-498413-u6",
  "pubsubTopic": "iot.telemetry.received",
  "realtimeTokenMinted": true
}
```

## Lambda Delivery Logs

CloudWatch showed two successful Lambda invocations and two Pub/Sub message IDs:

```text
INFO {"eventId":"a81fca6d-bb9a-4775-b62a-50e36d67c157","messageId":"19657535747485690","topic":"iot.telemetry.received","deviceCode":"aq-dev-simulator-01","seqNo":1780642880322}
INFO {"eventId":"cbf525f2-6b20-42ed-96ee-f750c401aa29","messageId":"19657291811274956","topic":"iot.telemetry.received","deviceCode":"aq-dev-simulator-01","seqNo":1780642880321}
```

## Conclusion

PASS. The live AWS IoT/Lambda bridge is deployed and exercised with a real x.509 MQTT publish. The bridge delivered telemetry into real Google Pub/Sub through GCP Workload Identity Federation, and the managed GKE runtime produced the expected AquaShield business outputs: energy total, active threshold alert, pond comparison metrics, realtime token, and audit rows.
