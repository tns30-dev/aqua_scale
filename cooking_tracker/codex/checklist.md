# Codex Implementation Checklist

Source checklist: [main/checklist.md](../main/checklist.md)

## Architecture And Contracts

| Status | Item | Output | Reference Doc |
|---|---|---|---|
| [ ] | Target bounded contexts | Service ownership and domain boundaries | [logical_arch_docs.md](../main/logical_arch_docs.md) |
| [ ] | Logical microservices architecture | Logical service diagram | [logical_arch_docs.md](../main/logical_arch_docs.md) |
| [ ] | Physical cloud architecture | Cloud architecture diagram with VPC/firewall/data tiers | [physical_arch_docs.md](../main/physical_arch_docs.md) |
| [ ] | Deployment architecture | Implementation and presentation deployment diagrams | [deployment_docs.md](../main/deployment_docs.md) |
| [ ] | Event-driven architecture | Event flow diagram and topic list | [eda.md](../main/eda.md), [eda_docs.md](../main/eda_docs.md) |
| [ ] | API contract documentation | REST endpoint catalogue | [api_contract_docs.md](../main/api_contract_docs.md) |
| [ ] | gRPC contract documentation | Service-to-service contract map | [api_contract_docs.md](../main/api_contract_docs.md), [service_discovery.md](../main/service_discovery.md) |
| [ ] | Pub/Sub contract documentation | Topic, subscription, schema, DLQ catalogue | [pub_sub_contract_docs.md](../main/pub_sub_contract_docs.md) |
| [ ] | ERD documentation | Service-owned ERD and table ownership map | [erd_docs.md](../main/erd_docs.md) |

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
| [ ] | Artifact Registry | Container repositories created | [ci.md](../main/ci.md), [cd.md](../main/cd.md) |
| [ ] | Terraform remote state | Google Cloud Storage bucket stores Terraform state | [terraform.md](../main/terraform.md) |

## Edge And Frontend

| Status | Item | Output | Reference Doc |
|---|---|---|---|
| [ ] | Firebase Hosting | React SPA hosted as static frontend | [frontend_deployment.md](../main/frontend_deployment.md), [cdn.md](../main/cdn.md) |
| [ ] | CDN | Firebase Hosting CDN for frontend; Cloud CDN only if additional backend static assets are used | [cdn.md](../main/cdn.md) |
| [ ] | GCP API edge | External HTTPS Load Balancer, Gateway/Ingress, managed TLS | [api_gateway.md](../main/api_gateway.md), [physical_arch_docs.md](../main/physical_arch_docs.md) |
| [ ] | Cloud Armor | WAF and rate-limit policy for REST and WebSocket token endpoints | [api_gateway.md](../main/api_gateway.md), [network_security.md](../main/network_security.md) |
| [ ] | WSS realtime endpoint | `wss://api.aquashield.example.com/ws` public WebSocket endpoint | [websocket.md](../main/websocket.md) |
