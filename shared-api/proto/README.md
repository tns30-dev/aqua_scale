# gRPC Contracts

Internal service-to-service traffic uses gRPC over Kubernetes Service DNS and mesh mTLS.

## Current Scope

| Proto | Owner | Purpose |
|---|---|---|
| `aquashield/common/v1/common.proto` | Shared | Request context, pagination, common scalar wrappers |
| `aquashield/identity/v1/identity_service.proto` | Identity and Access | Token, authorization snapshot, fallback authorization |
| `aquashield/project/v1/project_service.proto` | Project | Project/profile/parameter settings lookup |
| `aquashield/pond/v1/pond_service.proto` | Pond | Pond, cycle, summary lookup |
| `aquashield/sensor/v1/sensor_service.proto` | Sensor | Device, port, validation metadata lookup for ingestion |

Notification, Realtime, Analytics, and Audit are mainly REST/event-driven in the first implementation. Add gRPC contracts for them only when a real internal caller needs that boundary.

## Validation

Run:

```bash
protoc -I shared-api/proto $(find shared-api/proto/aquashield -name '*.proto') --descriptor_set_out=/tmp/aquashield-contracts.pb
```
