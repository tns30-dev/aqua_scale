# Codex Implementation Checklist

Source checklist: [main/checklist.md](../main/checklist.md)

Ownership rule from 2026-06-05: Codex owns every non-service track. The Claude folder is now service-delivery history only: implemented service skeletons, CRUD/parity service work, and optional ML/LLM placeholders.

## Architecture And Contracts

| Status | Item | Output | Reference Doc |
|---|---|---|---|
| [x] | Target bounded contexts | Service ownership and domain boundaries | [logical_arch_docs.md](../main/logical_arch_docs.md) |
| [x] | Logical microservices architecture | Logical service diagram | [logical_arch_docs.md](../main/logical_arch_docs.md) |
| [x] | Physical cloud architecture | Cloud architecture diagram with VPC/firewall/data tiers | [physical_arch_docs.md](../main/physical_arch_docs.md) |
| [x] | Deployment architecture | Implementation and presentation deployment diagrams | [deployment_docs.md](../main/deployment_docs.md) |
| [x] | Event-driven architecture | Event flow diagram and topic list | [eda.md](../main/eda.md), [eda_docs.md](../main/eda_docs.md) |
| [x] | API contract documentation | REST endpoint catalogue | [api_contract_docs.md](../main/api_contract_docs.md) |
| [x] | gRPC contract documentation | Service-to-service contract map | [api_contract_docs.md](../main/api_contract_docs.md), [service_discovery.md](../main/service_discovery.md) |
| [x] | Pub/Sub contract documentation | Topic, subscription, schema, DLQ catalogue | [pub_sub_contract_docs.md](../main/pub_sub_contract_docs.md) |
| [x] | ERD documentation | Service-owned ERD and table ownership map | [erd_docs.md](../main/erd_docs.md) |

## Cloud Foundation

| Status | Item | Output | Reference Doc |
|---|---|---|---|
| [ ] | Custom VPC | Dedicated AquaShield network | [network_security.md](../main/network_security.md), [physical_arch_docs.md](../main/physical_arch_docs.md) |
| [ ] | GKE subnet | Node subnet created | [gke.md](../main/gke.md), [network_security.md](../main/network_security.md) |
| [ ] | Pod secondary range | VPC-native pod range configured | [gke.md](../main/gke.md) |
| [ ] | Service secondary range | VPC-native service range configured | [gke.md](../main/gke.md) |
| [ ] | Private nodes | GKE nodes private if feasible | [gke.md](../main/gke.md), [network_security.md](../main/network_security.md) |
| [ ] | Cloud NAT | Controlled outbound egress for private nodes | [network_security.md](../main/network_security.md) |
| [ ] | Private Google Access / PSC | Private access to Google APIs and managed services | [network_security.md](../main/network_security.md), [physical_arch_docs.md](../main/physical_arch_docs.md) |
| [ ] | VPC firewall rules | Health check, web-to-app, internal, app-to-data, deny-default controls | [network_security.md](../main/network_security.md) |
| [ ] | Kubernetes NetworkPolicy | Pod-to-pod traffic controls | [network_security.md](../main/network_security.md), [gke.md](../main/gke.md) |
| [ ] | Istio service mesh | mTLS, AuthorizationPolicy, service identity controls | [service_discovery.md](../main/service_discovery.md), [network_security.md](../main/network_security.md) |
| [ ] | Namespaces | Environment namespaces created | [gke.md](../main/gke.md) |
| [x] | Artifact Registry | Container repositories created | [ci.md](../main/ci.md), [cd.md](../main/cd.md) |
| [x] | Terraform remote state | Google Cloud Storage bucket stores Terraform state | [terraform.md](../main/terraform.md) |

## Edge And Frontend

| Status | Item | Output | Reference Doc |
|---|---|---|---|
| [ ] | Firebase Hosting | React SPA hosted as static frontend | [frontend_deployment.md](../main/frontend_deployment.md), [cdn.md](../main/cdn.md) |
| [ ] | Frontend integration | React/Vite SPA integrated with REST API edge and WSS realtime gateway | [frontend.md](../main/frontend.md), [api_contract_docs.md](../main/api_contract_docs.md), [websocket.md](../main/websocket.md) |
| [ ] | CDN | Firebase Hosting CDN for frontend; Cloud CDN only if additional backend static assets are used | [cdn.md](../main/cdn.md) |
| [ ] | GCP API edge | External HTTPS Load Balancer, Gateway/Ingress, managed TLS | [api_gateway.md](../main/api_gateway.md), [physical_arch_docs.md](../main/physical_arch_docs.md) |
| [ ] | Cloud Armor | WAF and rate-limit policy for REST and WebSocket token endpoints | [api_gateway.md](../main/api_gateway.md), [network_security.md](../main/network_security.md) |
| [ ] | WSS realtime endpoint | `wss://api.aquashield.example.com/ws` public WebSocket endpoint | [websocket.md](../main/websocket.md) |

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
| [ ] | Terraform-managed infrastructure | Repeatable infrastructure provisioning where feasible, backed by GCS remote state | [terraform.md](../main/terraform.md) |

## Security

| Status | Item | Output | Reference Doc |
|---|---|---|---|
| [x] | Authn/Authz workflow | JWT, Redis authz snapshot, refresh, revocation, ACL flow | [authn_authz.md](../main/authn_authz.md) |
| [x] | Identity authorization snapshot | Feature access and ACL stored in Redis after login | [identity_and_access_service.md](../main/identity_and_access_service.md), [redis.md](../main/redis.md) |
| [x] | Token lifecycle | Login, refresh rotation, logout, revocation, MFA optional state | [identity_and_access_service.md](../main/identity_and_access_service.md), [authn_authz.md](../main/authn_authz.md) |
| [ ] | Three-layer firewall model | Internet-to-web, web-to-app, app-to-app, app-to-data controls | [network_security.md](../main/network_security.md) |
| [ ] | Service-to-service protection | Kubernetes service identity, Istio mTLS, AuthorizationPolicy | [service_discovery.md](../main/service_discovery.md), [network_security.md](../main/network_security.md) |
| [ ] | Security evidence | SAST, SCA, secret scan, container scan, DAST reports | [ci.md](../main/ci.md), [cd.md](../main/cd.md) |

## CI/CD And Testing

| Status | Item | Output | Reference Doc |
|---|---|---|---|
| [x] | Path-aware CI workflows | Build/test/scan only affected services | [ci.md](../main/ci.md) |
| [x] | Artifact Registry push | Versioned image pushed by CI | [ci.md](../main/ci.md), [cd.md](../main/cd.md) |
| [x] | GitOps manifest update | Kustomize image tag updated after successful CI | [ci.md](../main/ci.md), [cd.md](../main/cd.md) |
| [ ] | Argo CD rollout | Argo CD sync and health evidence | [cd.md](../main/cd.md) |
| [ ] | Smoke tests | Health and contract checks after deployment | [cd.md](../main/cd.md) |
| [ ] | DAST | OWASP ZAP or equivalent scan after deployment | [cd.md](../main/cd.md) |
| [ ] | JMeter load and stress tests | Evidence from dedicated `performance-test` branch or manual dispatch | [ci.md](../main/ci.md) |
| [ ] | Demo evidence | Screenshots, logs, videos, cloud console proof | All docs |
