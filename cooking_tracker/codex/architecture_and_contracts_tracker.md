# Architecture And Contracts Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns architecture, contracts, diagrams, and cross-service integration documentation.
- Current state: The main architecture and contract docs are already consolidated. Shared API artifacts exist under `shared-api/`, the CI/CD path proves all nine deployable service images can be handed to GitOps, the GKE/network runtime foundation exists in GCP, Argo CD has a healthy managed-backed public-edge dev rollout, the managed business smoke proves the core telemetry business flow, the AWS IoT/Lambda bridge is live and smoked through GCP Pub/Sub, the public HTTPS edge is live at `https://api.aquashield.live`, and Firebase Hosting serves the frontend default site with live API/WSS endpoints.
- Current test: Validate docs against implemented service contracts, generated proto files, JSON event schemas, Kustomize/Gateway/proxy routing, deploy-handoff evidence, live GKE foundation evidence, managed GCP resource evidence, Argo CD public-edge evidence, managed business-flow smoke evidence, AWS IoT/Lambda live smoke evidence, Firebase Hosting live deploy evidence, custom-domain DNS evidence, public HTTPS edge evidence, and CI/SAST recovery evidence.
- Next test: Re-check frontend deployment docs after `www.aquashield.live` certificate activation.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Target bounded contexts | DONE | Main logical architecture docs define ownership and domain boundaries. | `../main/logical_arch_docs.md` | 2026-06-04 |
| Logical microservices architecture | DONE | Logical service diagram documented. | `../main/logical_arch_docs.md` | 2026-06-04 |
| Physical cloud architecture | DONE | Physical cloud diagram covers VPC, firewall, data tiers, GitOps, and AWS IoT boundary. | `../main/physical_arch_docs.md` | 2026-06-04 |
| Deployment architecture | DONE | Detailed and presentation deployment diagrams documented. | `../main/deployment_docs.md` | 2026-06-04 |
| Event-driven architecture | DONE | Event scope corrected; implemented Project/Sensor/Audit events are represented, Analytics event consumers are future-only. | `../main/eda.md`, `../main/eda_docs.md` | 2026-06-04 |
| API contract documentation | DONE | REST catalogue prepared with monolith parity consideration; Project Service OpenAPI parity contract extracted. | `../main/api_contract_docs.md`, `../../shared-api/openapi/project-service.v1.yaml`, `../../docs/evidence/contracts/2026-06-04-project-openapi-extraction.md` | 2026-06-04 |
| gRPC contract documentation | DONE | Service discovery docs and initial proto contracts exist for service lookup/support calls. | `../main/api_contract_docs.md`, `../main/service_discovery.md`, `../../shared-api/proto/`, `../../docs/evidence/contracts/2026-06-04-shared-contract-validation.md` | 2026-06-04 |
| Pub/Sub contract documentation | DONE | Topic/subscription/DLQ contracts documented and schema files created for current event catalogue. | `../main/pub_sub_contract_docs.md`, `../../shared-api/events/`, `../../docs/evidence/audit-service/SHIP.md` | 2026-06-04 |
| ERD documentation | DONE | Service-owned ERD documentation placeholder/checklist prepared. | `../main/erd_docs.md` | 2026-06-04 |

## Validation

| Check | Result | Updated |
|---|---|---|
| Shared contract validation | PASS; `protoc` and `jq` validation evidence exists. | 2026-06-04 |
| Tracker ownership rewrite | PASS; tracker no longer depends on Claude handoff language. | 2026-06-05 |
| Deploy handoff alignment | PASS; all implemented services have images and dev GitOps image references. | 2026-06-05 |
| Runtime foundation alignment | PASS; physical/deployment architecture now has live VPC, subnet, NAT, firewall, and private-node GKE evidence. | 2026-06-05 |
| GitOps full-runtime alignment | PASS; deployment architecture now has live Istio, Argo CD, Artifact Registry pull, and full nine-service runtime evidence. | 2026-06-05 |
| Managed data architecture alignment | PASS; documented Cloud SQL, Memorystore, Pub/Sub, Bigtable, and BigQuery target architecture now has Terraform apply evidence and a live managed-backed dev rollout. | 2026-06-05 |
| Managed business-flow alignment | PASS; telemetry path from signed device payload through Pub/Sub, ingestion, alerting, realtime token minting, analytics JSON, and audit is evidenced on the managed runtime. | 2026-06-05 |
| AWS IoT bridge contract alignment | PASS; `iot.telemetry.received` schema matches the live ingestion payload, and the Lambda bridge preserves signed payloads while wrapping the canonical envelope. Live x.509 MQTT delivery through AWS IoT, Lambda, GCP WIF, and Pub/Sub is evidenced. | 2026-06-05 |
| Public edge contract alignment | PASS; Gateway/HTTPRoute uses supported `/api` and `/ws` prefix routing to `api-edge-proxy`, while the proxy preserves implemented service path ownership and nested route exceptions. `https://api.aquashield.live` is live and the public smoke proved identity, project, pond, sensor, ingestion, notification, analytics, realtime, and audit paths. | 2026-06-05 |
| Frontend deployment alignment | PASS; Firebase Hosting default site serves the production SPA with live `https://api.aquashield.live` and `wss://api.aquashield.live` endpoints. `www.aquashield.live` host ownership is active and waits on Firebase certificate activation. | 2026-06-05 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Added shared gRPC proto contracts and Pub/Sub JSON schemas under `shared-api/`; validated with `protoc` and `jq`. |
| 2026-06-04 | Extracted Project Service public REST OpenAPI contract from `module_project` and frontend call sites; validated YAML parse. |
| 2026-06-04 | Updated Redis, API, service discovery, and Pub/Sub docs as implementation discoveries landed. |
| 2026-06-05 | Rephrased tracker for Codex-only non-service ownership. |
| 2026-06-05 | Confirmed deployment docs now have matching evidence for Artifact Registry image handoff and dev Kustomize references across all implemented services. |
| 2026-06-05 | Confirmed physical/deployment architecture now has live GKE/network evidence; Cloud Armor remains design-only for this implementation and edge rollout remains pending. |
| 2026-06-05 | Confirmed GitOps architecture now has live evidence through Argo CD `Synced/Healthy` full-runtime rollout at revision `9545374571ff969a34c11152850bc1ed56852c3c`. |
| 2026-06-05 | Added managed GCP data cutover evidence for Cloud SQL, Memorystore, real Pub/Sub, Bigtable, BigQuery, and Argo CD `dev-managed` rollout. |
| 2026-06-05 | Added managed business-flow smoke evidence and set AWS IoT/Lambda bridge as the next architecture-validation slice before public edge/Firebase. |
| 2026-06-05 | Added AWS IoT/Lambda bridge code-readiness evidence and aligned the `iot.telemetry.received` schema with the actual ingestion contract. |
| 2026-06-05 | Added AWS IoT/Lambda live deploy and smoke evidence; the physical/event architecture now has an exercised AWS-to-GCP telemetry path. |
| 2026-06-05 | Added initial public edge/Firebase readiness evidence; superseded the temporary HTTP branch with the HTTPS static-IP path. |
| 2026-06-05 | Switched public edge architecture to HTTPS with an in-cluster proxy for path-aware routing and reserved static IP `8.232.154.25`; at that point live proof was waiting on real domain/DNS/managed certificate. |
| 2026-06-05 | Proved the public edge architecture live at `https://api.aquashield.live`: DNS, managed TLS, GKE Gateway, `api-edge-proxy`, mesh routing, and full business-flow smoke all align with the documented contract model. |
| 2026-06-05 | Deployed the frontend contract surface to Firebase Hosting with live API/WSS endpoints and configured `www.aquashield.live` DNS for Firebase custom-domain activation. |
