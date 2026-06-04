# Claude Implementation Checklist

Source checklist: [main/checklist.md](../main/checklist.md)

## Data And Messaging

| Status | Item | Output | Reference Doc |
|---|---|---|---|
| [ ] | Cloud SQL PostgreSQL primary | Transactional database for service-owned business data | [polyglot_persistence.md](../main/polyglot_persistence.md) |
| [ ] | Cloud SQL read replica | Read-scaling evidence for low-risk read paths | [polyglot_persistence.md](../main/polyglot_persistence.md) |
| [ ] | Redis/Memorystore | Authz snapshot, cache, rate-limit, WebSocket fanout | [redis.md](../main/redis.md), [authn_authz.md](../main/authn_authz.md) |
| [ ] | Cloud Bigtable | Target telemetry time-series store; cost-safe evidence or emulator path | [polyglot_persistence.md](../main/polyglot_persistence.md) |
| [ ] | BigQuery | Target analytics warehouse; bounded demo dataset and cost controls | [polyglot_persistence.md](../main/polyglot_persistence.md), [analytics_service.md](../main/analytics_service.md) |
| [ ] | Cloud Storage | Reports, exports, archives, artifacts, future ML assets | [polyglot_persistence.md](../main/polyglot_persistence.md) |
| [ ] | Google Pub/Sub | Topics, subscriptions, schemas, DLQs | [eda.md](../main/eda.md), [pub_sub_contract_docs.md](../main/pub_sub_contract_docs.md) |
| [ ] | AWS IoT Core | MQTT broker, device identity, certificates, policies, rules | [iot.md](../main/iot.md) |
| [ ] | AWS Lambda bridge | AWS IoT event bridge into Google Pub/Sub | [iot.md](../main/iot.md), [physical_arch_docs.md](../main/physical_arch_docs.md) |
| [ ] | Terraform-managed infrastructure | Repeatable infrastructure provisioning where feasible | [terraform.md](../main/terraform.md) |

## Security

| Status | Item | Output | Reference Doc |
|---|---|---|---|
| [x] | Authn/Authz workflow | JWT, Redis authz snapshot, refresh, revocation, ACL flow | [authn_authz.md](../main/authn_authz.md) |
| [x] | Identity authorization snapshot | Feature access and ACL stored in Redis after login | [identity_and_access_service.md](../main/identity_and_access_service.md), [redis.md](../main/redis.md) |
| [x] | Token lifecycle | Login, refresh rotation, logout, revocation, MFA optional state | [identity_and_access_service.md](../main/identity_and_access_service.md), [authn_authz.md](../main/authn_authz.md) |
| [ ] | Three-layer firewall model | Internet-to-web, web-to-app, app-to-app, app-to-data controls | [network_security.md](../main/network_security.md) |
| [ ] | Service-to-service protection | Kubernetes service identity, Istio mTLS, AuthorizationPolicy | [service_discovery.md](../main/service_discovery.md), [network_security.md](../main/network_security.md) |
| [ ] | Security evidence | SAST, SCA, secret scan, container scan, DAST reports | [ci.md](../main/ci.md), [cd.md](../main/cd.md) |

## Services

| Status | Service | Output | Reference Doc |
|---|---|---|---|
| [x] | Identity and Access Service | Java service skeleton, auth contracts, Redis authz snapshot | [identity_and_access_service.md](../main/identity_and_access_service.md) |
| [x] | Project Service | Java service skeleton and project/profile/config contracts | [project_service.md](../main/project_service.md) |
| [ ] | Pond Service | Java service skeleton and pond/cycle contracts | [pond_service.md](../main/pond_service.md) |
| [x] | Sensor Service | Java service skeleton and device/port mapping contracts | [sensor_service.md](../main/sensor_service.md) |
| [x] | Ingestion Service | Java Pub/Sub consumer, validation, Bigtable/persistence flow | [ingestion_service.md](../main/ingestion_service.md) |
| [x] | Notification Service | Java alert and notification event flow | [notification_service.md](../main/notification_service.md) |
| [x] | Realtime Gateway | Java WebFlux WSS gateway with Redis fanout | [websocket.md](../main/websocket.md) |
| [ ] | Analytics Service | TypeScript/Express chart API with Bigtable/BigQuery read paths | [analytics_service.md](../main/analytics_service.md) |
| [ ] | Audit Service | Java append-only audit consumer and query path | [audit_service.md](../main/audit_service.md) |
| [ ] | ML placeholder | Future add-on placeholder | [ml.md](../main/ml.md) |
| [ ] | LLM placeholder | Future add-on placeholder | [llm.md](../main/llm.md) |

## CI/CD And Testing

| Status | Item | Output | Reference Doc |
|---|---|---|---|
| [x] | Path-aware CI workflows | Build/test/scan only affected services | [ci.md](../main/ci.md) |
| [ ] | Artifact Registry push | Versioned image pushed by CI | [ci.md](../main/ci.md), [cd.md](../main/cd.md) |
| [ ] | GitOps manifest update | Kustomize image tag updated after successful CI | [ci.md](../main/ci.md), [cd.md](../main/cd.md) |
| [ ] | Argo CD rollout | Argo CD sync and health evidence | [cd.md](../main/cd.md) |
| [ ] | Smoke tests | Health and contract checks after deployment | [cd.md](../main/cd.md) |
| [ ] | DAST | OWASP ZAP or equivalent scan after deployment | [cd.md](../main/cd.md) |
| [ ] | JMeter load and stress tests | Evidence from dedicated `performance-test` branch or manual dispatch | [ci.md](../main/ci.md) |
| [ ] | Demo evidence | Screenshots, logs, videos, cloud console proof | All docs |
