# IoT Ingress Checklist

## Target

| Item | Selection |
|---|---|
| Device protocol | MQTT over TLS |
| Managed IoT ingress | AWS IoT Core |
| Device identity | X.509 device certificate and IoT policy |
| Edge source | Raspberry Pi publisher or simulator |
| Cross-cloud bridge | AWS IoT Rule to TypeScript AWS Lambda |
| Internal event bus target | Google Pub/Sub topic `iot.telemetry.received` |
| Future edge add-on | AWS IoT Greengrass V2 |

## Topic Plan

| Status | Topic Pattern | Purpose |
|---|---|---|
| [ ] | `aquashield/{projectId}/{deviceId}/telemetry` | Normal telemetry |
| [ ] | `aquashield/{projectId}/{deviceId}/status` | Device status |
| [ ] | `aquashield/{projectId}/{deviceId}/alerts` | Device-side alert/status signal |
| [ ] | `aquashield/{projectId}/{deviceId}/debug` | Controlled demo/debug only |

## AWS IoT Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Create IoT thing type | Device category registered |
| [ ] | Create test IoT thing | Demo device registered |
| [ ] | Generate device certificate | Cert/key pair |
| [ ] | Attach IoT policy | Topic-scoped publish permissions |
| [ ] | Store cert securely on device/simulator | Local demo config |
| [ ] | Configure MQTT TLS endpoint | Device can connect |
| [ ] | Create IoT Rule | Telemetry routed to Lambda |
| [ ] | Add IoT Rule error action/alarm | Failed bridge visibility |

## Lambda Bridge Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Create TypeScript Lambda project | Bridge skeleton |
| [ ] | Parse AWS IoT event envelope | Extract topic, payload, cert/device metadata |
| [ ] | Add schemaVersion and correlation IDs | Normalized event envelope |
| [ ] | Preserve raw payload and HMAC fields | Downstream validation possible |
| [ ] | Authenticate to GCP with Workload Identity Federation | No long-lived GCP key |
| [ ] | Grant `pubsub.publisher` only | Least-privilege publisher |
| [ ] | Publish to `iot.telemetry.received` | Pub/Sub event visible |
| [ ] | Add CloudWatch logs and alarm | Bridge observability |

## Payload Fields

| Field | Requirement |
|---|---|
| `deviceId` | Required |
| `seqNo` | Required for idempotency/replay checks |
| `measuredAt` | Required |
| `readings` | Required parameter/value map |
| `signature` | Required if HMAC signing is enabled |
| `projectId` | Preferred if known at edge; otherwise resolved by Sensor Service |
| `pondId` | Optional at edge; resolved by Sensor Service if missing |

## Evidence Checklist

| Status | Evidence | Expected Result |
|---|---|---|
| [ ] | MQTT publish from simulator/device | AWS IoT receives message |
| [ ] | IoT Rule invocation | Lambda invoked |
| [ ] | Lambda log | Normalized event emitted |
| [ ] | Pub/Sub message | `iot.telemetry.received` receives event |
| [ ] | Invalid device/topic attempt | Publish blocked by IoT policy |
| [ ] | Failed bridge alarm | Failure path visible |

