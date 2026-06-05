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
| [x] | Custom VPC | Dedicated AquaShield network | [network_security.md](../main/network_security.md), [physical_arch_docs.md](../main/physical_arch_docs.md) |
| [x] | GKE subnet | Node subnet created | [gke.md](../main/gke.md), [network_security.md](../main/network_security.md) |
| [x] | Pod secondary range | VPC-native pod range configured | [gke.md](../main/gke.md) |
| [x] | Service secondary range | VPC-native service range configured | [gke.md](../main/gke.md) |
| [x] | Private nodes | GKE nodes private if feasible | [gke.md](../main/gke.md), [network_security.md](../main/network_security.md) |
| [x] | Cloud NAT | Controlled outbound egress for private nodes | [network_security.md](../main/network_security.md) |
| [x] | Private Google Access / PSC | Private Google Access enabled and private service access applied for Cloud SQL/Memorystore private endpoints | [network_security.md](../main/network_security.md), [physical_arch_docs.md](../main/physical_arch_docs.md) |
| [x] | VPC firewall rules | Health check and internal GKE firewall controls | [network_security.md](../main/network_security.md) |
| [x] | Kubernetes NetworkPolicy | Default-deny and analytics smoke ingress controls live in GKE | [network_security.md](../main/network_security.md), [gke.md](../main/gke.md) |
| [x] | Istio service mesh | Istio control plane, sidecar injection, strict mTLS, and AuthorizationPolicy proven on the managed full dev runtime | [service_discovery.md](../main/service_discovery.md), [network_security.md](../main/network_security.md) |
| [x] | Namespaces | `aquashield-dev` namespace created with Istio injection enabled | [gke.md](../main/gke.md) |
| [x] | Artifact Registry | Container repositories created | [ci.md](../main/ci.md), [cd.md](../main/cd.md) |
| [x] | Terraform remote state | Google Cloud Storage bucket stores Terraform state | [terraform.md](../main/terraform.md) |

## Edge And Frontend

| Status | Item | Output | Reference Doc |
|---|---|---|---|
| [ ] | Firebase Hosting | React SPA hosted as static frontend | [frontend_deployment.md](../main/frontend_deployment.md), [cdn.md](../main/cdn.md) |
| [ ] | Frontend integration | React/Vite SPA integrated with REST API edge and WSS realtime gateway | [frontend.md](../main/frontend.md), [api_contract_docs.md](../main/api_contract_docs.md), [websocket.md](../main/websocket.md) |
| [ ] | CDN | Firebase Hosting CDN for frontend; Cloud CDN only if additional backend static assets are used | [cdn.md](../main/cdn.md) |
| [ ] | GCP API edge | External HTTPS Load Balancer, Gateway/Ingress, managed TLS | [api_gateway.md](../main/api_gateway.md), [physical_arch_docs.md](../main/physical_arch_docs.md) |
| [ ] | Cloud Armor | Design documented; runtime evidence out of current scope | [api_gateway.md](../main/api_gateway.md), [network_security.md](../main/network_security.md) |
| [ ] | WSS realtime endpoint | `wss://api.aquashield.example.com/ws` public WebSocket endpoint | [websocket.md](../main/websocket.md) |

## Data And Messaging

| Status | Item | Output | Reference Doc |
|---|---|---|---|
| [x] | Cloud SQL PostgreSQL primary | Private PostgreSQL 16 instance live at `10.128.1.3`; service schemas bootstrapped and workloads cut over | [polyglot_persistence.md](../main/polyglot_persistence.md) |
| [ ] | Cloud SQL read replica | Read-scaling evidence for low-risk read paths | [polyglot_persistence.md](../main/polyglot_persistence.md) |
| [x] | Redis/Memorystore | Memorystore Redis `10.128.0.3:6379` is live and the managed overlay points services at it | [redis.md](../main/redis.md), [authn_authz.md](../main/authn_authz.md) |
| [x] | Cloud Bigtable | `aquashield-dev-telemetry/telemetry_readings` is live; native app repository wiring remains a future service slice | [polyglot_persistence.md](../main/polyglot_persistence.md) |
| [x] | BigQuery | `aquashield_dev_analytics` with `readings` and `alerts` tables is live; deeper analytics wiring remains a future service slice | [polyglot_persistence.md](../main/polyglot_persistence.md), [analytics_service.md](../main/analytics_service.md) |
| [ ] | Cloud Storage | Reports, exports, archives, artifacts, future ML assets | [polyglot_persistence.md](../main/polyglot_persistence.md) |
| [x] | Google Pub/Sub | Real Pub/Sub catalogue live with 36 topics and 45 subscriptions; managed overlay removes emulator config | [eda.md](../main/eda.md), [pub_sub_contract_docs.md](../main/pub_sub_contract_docs.md) |
| [ ] | AWS IoT Core | MQTT broker, device identity, certificates, policies, rules | [iot.md](../main/iot.md) |
| [ ] | AWS Lambda bridge | AWS IoT event bridge into Google Pub/Sub | [iot.md](../main/iot.md), [physical_arch_docs.md](../main/physical_arch_docs.md) |
| [x] | Terraform-managed infrastructure | Remote state, Artifact Registry, WIF, VPC, NAT, firewall, GKE, private service access, Cloud SQL, Memorystore, Pub/Sub, Bigtable, and BigQuery are Terraform-owned | [terraform.md](../main/terraform.md) |

## Security

| Status | Item | Output | Reference Doc |
|---|---|---|---|
| [x] | Authn/Authz workflow | JWT, Redis authz snapshot, refresh, revocation, ACL flow | [authn_authz.md](../main/authn_authz.md) |
| [x] | Identity authorization snapshot | Feature access and ACL stored in Redis after login | [identity_and_access_service.md](../main/identity_and_access_service.md), [redis.md](../main/redis.md) |
| [x] | Token lifecycle | Login, refresh rotation, logout, revocation, MFA optional state | [identity_and_access_service.md](../main/identity_and_access_service.md), [authn_authz.md](../main/authn_authz.md) |
| [ ] | Three-layer firewall model | Internet-to-web, web-to-app, app-to-app, app-to-data controls | [network_security.md](../main/network_security.md) |
| [x] | Service-to-service protection | Kubernetes service identity, Istio strict mTLS, and AuthorizationPolicy proven on the live managed dev runtime | [service_discovery.md](../main/service_discovery.md), [network_security.md](../main/network_security.md) |
| [ ] | Security evidence | SAST, SCA, secret scan, container scan, DAST reports | [ci.md](../main/ci.md), [cd.md](../main/cd.md) |

## CI/CD And Testing

| Status | Item | Output | Reference Doc |
|---|---|---|---|
| [x] | Path-aware CI workflows | Build/test/scan only affected services | [ci.md](../main/ci.md) |
| [x] | Artifact Registry push | All nine implemented service images pushed with Git-SHA tags | [ci.md](../main/ci.md), [cd.md](../main/cd.md) |
| [x] | GitOps manifest update | Dev Kustomize image tags updated for all nine services | [ci.md](../main/ci.md), [cd.md](../main/cd.md) |
| [x] | Argo CD rollout | Argo CD sync and health evidence for the managed-backed nine-service dev runtime | [cd.md](../main/cd.md) |
| [x] | Smoke tests | Managed-backed business flow passed across identity, project, pond, sensor, ingestion, notification, realtime, analytics, and audit surfaces | [cd.md](../main/cd.md) |
| [ ] | DAST | OWASP ZAP or equivalent scan after deployment | [cd.md](../main/cd.md) |
| [ ] | JMeter load and stress tests | Evidence from dedicated `performance-test` branch or manual dispatch | [ci.md](../main/ci.md) |
| [ ] | Demo evidence | Managed runtime rollout and business-flow smoke evidence recorded; public edge, AWS bridge, DAST, and performance evidence remain | All docs |
