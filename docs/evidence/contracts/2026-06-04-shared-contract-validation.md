# Shared Contract Validation - 2026-06-04

## Scope

Validated the initial shared API contract foundation.

## Commands

| Command | Result |
|---|---|
| `find shared-api/events -name '*.json' -print0 \| xargs -0 -n1 jq empty` | PASS |
| `protoc -I shared-api/proto $(find shared-api/proto/aquashield -name '*.proto') --descriptor_set_out=/tmp/aquashield-contracts.pb` | PASS |

## Contract Files

| Contract Area | Location |
|---|---|
| Common proto types | `shared-api/proto/aquashield/common/v1/common.proto` |
| Identity gRPC | `shared-api/proto/aquashield/identity/v1/identity_service.proto` |
| Project gRPC | `shared-api/proto/aquashield/project/v1/project_service.proto` |
| Pond gRPC | `shared-api/proto/aquashield/pond/v1/pond_service.proto` |
| Sensor gRPC | `shared-api/proto/aquashield/sensor/v1/sensor_service.proto` |
| Pub/Sub JSON schemas | `shared-api/events/*.v1.json` |

## Notes

The gRPC scope covers the explicit internal lookup/support contracts required by the current service specs. Notification, Realtime, Analytics, and Audit remain event/REST-first until a real internal gRPC caller is identified.
