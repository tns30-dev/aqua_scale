# AquaShield Main Implementation Checklist

## Architecture And Contracts

| Status | Owner | Item | Output | Reference Doc |
|---|---|---|---|---|
| [ ] | Codex | Target bounded contexts | Service ownership and domain boundaries | `logical_arch_docs.md` |
| [ ] | Codex | Logical microservices architecture | Logical service diagram | `logical_arch_docs.md` |
| [ ] | Codex | Physical cloud architecture | Cloud architecture diagram with VPC/firewall/data tiers | `physical_arch_docs.md` |
| [ ] | Codex | Deployment architecture | Implementation and presentation deployment diagrams | `deployment_docs.md` |
| [ ] | Codex | Event-driven architecture | Event flow diagram and topic list | `eda.md`, `eda_docs.md` |
| [ ] | Codex | API contract documentation | REST endpoint catalogue | `api_contract_docs.md` |
| [ ] | Codex | gRPC contract documentation | Service-to-service contract map | `api_contract_docs.md`, `service_discovery.md` |
| [ ] | Codex | Pub/Sub contract documentation | Topic, subscription, schema, DLQ catalogue | `pub_sub_contract_docs.md` |
| [ ] | Codex | ERD documentation | Service-owned ERD and table ownership map | `erd_docs.md` |

## Cloud Foundation

| Status | Owner | Item | Output | Reference Doc |
|---|---|---|---|---|
| [ ] | Codex | Custom VPC | Dedicated AquaShield network | `network_security.md`, `physical_arch_docs.md` |
| [ ] | Codex | GKE subnet | Node subnet created | `gke.md`, `network_security.md` |
| [ ] | Codex | Pod secondary range | VPC-native pod range configured | `gke.md` |
| [ ] | Codex | Service secondary range | VPC-native service range configured | `gke.md` |
| [ ] | Codex | Private nodes | GKE nodes private if feasible | `gke.md`, `network_security.md` |
| [ ] | Codex | Cloud NAT | Controlled outbound egress for private nodes | `network_security.md` |
| [ ] | Codex | Private Google Access / PSC | Private access to Google APIs and managed services | `network_security.md`, `physical_arch_docs.md` |
| [ ] | Codex | VPC firewall rules | Health check, web-to-app, internal, app-to-data, deny-default controls | `network_security.md` |
| [ ] | Codex | Kubernetes NetworkPolicy | Pod-to-pod traffic controls | `network_security.md`, `gke.md` |
| [ ] | Codex | Istio service mesh | mTLS, AuthorizationPolicy, service identity controls | `service_discovery.md`, `network_security.md` |
| [ ] | Codex | Namespaces | Environment namespaces created | `gke.md` |
| [ ] | Codex | Artifact Registry | Container repositories created | `ci.md`, `cd.md` |
| [ ] | Codex | Terraform remote state | Google Cloud Storage bucket stores Terraform state | `terraform.md` |

## Edge And Frontend

| Status | Owner | Item | Output | Reference Doc |
|---|---|---|---|---|
| [ ] | Codex | Firebase Hosting | React SPA hosted as static frontend | `frontend_deployment.md`, `cdn.md` |
| [ ] | Codex | Frontend integration | React/Vite SPA integrated with REST API edge and WSS realtime gateway | `frontend.md`, `api_contract_docs.md`, `websocket.md` |
| [ ] | Codex | CDN | Firebase Hosting CDN for frontend; Cloud CDN only if additional backend static assets are used | `cdn.md` |
| [ ] | Codex | GCP API edge | External HTTPS Load Balancer, Gateway/Ingress, managed TLS | `api_gateway.md`, `physical_arch_docs.md` |
| [ ] | Codex | Cloud Armor | WAF and rate-limit policy for REST and WebSocket token endpoints | `api_gateway.md`, `network_security.md` |
| [ ] | Codex | WSS realtime endpoint | `wss://api.aquashield.example.com/ws` public WebSocket endpoint | `websocket.md` |

## Data And Messaging

| Status | Owner | Item | Output | Reference Doc |
|---|---|---|---|---|
| [ ] | Claude | Cloud SQL PostgreSQL primary | Transactional database for service-owned business data | `polyglot_persistence.md` |
| [ ] | Claude | Cloud SQL read replica | Read-scaling evidence for low-risk read paths | `polyglot_persistence.md` |
| [ ] | Claude | Redis/Memorystore | Authz snapshot, cache, rate-limit, WebSocket fanout | `redis.md`, `authn_authz.md` |
| [ ] | Claude | Cloud Bigtable | Target telemetry time-series store; cost-safe evidence or emulator path | `polyglot_persistence.md` |
| [ ] | Claude | BigQuery | Target analytics warehouse; bounded demo dataset and cost controls | `polyglot_persistence.md`, `analytics_service.md` |
| [ ] | Claude | Cloud Storage | Reports, exports, archives, artifacts, future ML assets | `polyglot_persistence.md` |
| [ ] | Claude | Google Pub/Sub | Topics, subscriptions, schemas, DLQs | `eda.md`, `pub_sub_contract_docs.md` |
| [ ] | Claude | AWS IoT Core | MQTT broker, device identity, certificates, policies, rules | `iot.md` |
| [ ] | Claude | AWS Lambda bridge | AWS IoT event bridge into Google Pub/Sub | `iot.md`, `physical_arch_docs.md` |
| [ ] | Claude | Terraform-managed infrastructure | Repeatable infrastructure provisioning where feasible | `terraform.md` |

## Security

| Status | Owner | Item | Output | Reference Doc |
|---|---|---|---|---|
| [ ] | Claude | Authn/Authz workflow | JWT, Redis authz snapshot, refresh, revocation, ACL flow | `authn_authz.md` |
| [ ] | Claude | Identity authorization snapshot | Feature access and ACL stored in Redis after login | `identity_and_access_service.md`, `redis.md` |
| [ ] | Claude | Token lifecycle | Login, refresh rotation, logout, revocation, MFA optional state | `identity_and_access_service.md`, `authn_authz.md` |
| [ ] | Claude | Three-layer firewall model | Internet-to-web, web-to-app, app-to-app, app-to-data controls | `network_security.md` |
| [ ] | Claude | Service-to-service protection | Kubernetes service identity, Istio mTLS, AuthorizationPolicy | `service_discovery.md`, `network_security.md` |
| [ ] | Claude | Security evidence | SAST, SCA, secret scan, container scan, DAST reports | `ci.md`, `cd.md` |

## Services

| Status | Owner | Service | Output | Reference Doc |
|---|---|---|---|---|
| [ ] | Claude | Identity and Access Service | Java service skeleton, auth contracts, Redis authz snapshot | `identity_and_access_service.md` |
| [ ] | Claude | Project Service | Java service skeleton and project/profile/config contracts | `project_service.md` |
| [ ] | Claude | Pond Service | Java service skeleton and pond/cycle contracts | `pond_service.md` |
| [ ] | Claude | Sensor Service | Java service skeleton and device/port mapping contracts | `sensor_service.md` |
| [ ] | Claude | Ingestion Service | Java Pub/Sub consumer, validation, Bigtable/persistence flow | `ingestion_service.md` |
| [ ] | Claude | Notification Service | Java alert and notification event flow | `notification_service.md` |
| [ ] | Claude | Realtime Gateway | Java WebFlux WSS gateway with Redis fanout | `websocket.md` |
| [ ] | Claude | Analytics Service | TypeScript/Express chart API with Bigtable/BigQuery read paths | `analytics_service.md` |
| [ ] | Claude | Audit Service | Java append-only audit consumer and query path | `audit_service.md` |
| [ ] | Claude | ML placeholder | Future add-on placeholder | `ml.md` |
| [ ] | Claude | LLM placeholder | Future add-on placeholder | `llm.md` |

## CI/CD And Testing

| Status | Owner | Item | Output | Reference Doc |
|---|---|---|---|---|
| [ ] | Claude | Path-aware CI workflows | Build/test/scan only affected services | `ci.md` |
| [ ] | Claude | Artifact Registry push | Versioned image pushed by CI | `ci.md`, `cd.md` |
| [ ] | Claude | GitOps manifest update | Kustomize image tag updated after successful CI | `ci.md`, `cd.md` |
| [ ] | Claude | Argo CD rollout | Argo CD sync and health evidence | `cd.md` |
| [ ] | Claude | Smoke tests | Health and contract checks after deployment | `cd.md` |
| [ ] | Claude | DAST | OWASP ZAP or equivalent scan after deployment | `cd.md` |
| [ ] | Claude | JMeter load and stress tests | Evidence from dedicated `performance-test` branch or manual dispatch | `ci.md` |
| [ ] | Claude | Demo evidence | Screenshots, logs, videos, cloud console proof | All docs |
