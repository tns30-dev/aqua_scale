# Claude Implementation Checklist

Source checklist: [main/checklist.md](../main/checklist.md)

Active ownership rule from 2026-06-05: Claude keeps only the service implementation history. Codex owns architecture, cloud foundation, edge/frontend, data/messaging, security, CI/CD/testing, and final cloud evidence.

## Services

| Status | Service | Output | Reference Doc |
|---|---|---|---|
| [x] | Identity and Access Service | Java service skeleton, auth contracts, Redis authz snapshot | [identity_and_access_service.md](../main/identity_and_access_service.md) |
| [x] | Project Service | Java service skeleton and project/profile/config contracts | [project_service.md](../main/project_service.md) |
| [x] | Pond Service | Java service skeleton and pond/cycle contracts | [pond_service.md](../main/pond_service.md) |
| [x] | Sensor Service | Java service skeleton and device/port mapping contracts | [sensor_service.md](../main/sensor_service.md) |
| [x] | Ingestion Service | Java Pub/Sub consumer, validation, Bigtable/persistence flow | [ingestion_service.md](../main/ingestion_service.md) |
| [x] | Notification Service | Java alert and notification event flow | [notification_service.md](../main/notification_service.md) |
| [x] | Realtime Gateway | Java WebFlux WSS gateway with Redis fanout | [websocket.md](../main/websocket.md) |
| [x] | Analytics Service | TypeScript/Express chart API with Bigtable/BigQuery read paths | [analytics_service.md](../main/analytics_service.md) |
| [x] | Audit Service | Java append-only audit consumer and query path | [audit_service.md](../main/audit_service.md) |
| [ ] | ML placeholder | Future add-on placeholder | [ml.md](../main/ml.md) |
| [ ] | LLM placeholder | Future add-on placeholder | [llm.md](../main/llm.md) |
