# Architecture And Contracts Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns architecture, contracts, diagrams, and cross-service integration documentation.
- Current state: The main architecture and contract docs are already consolidated. Shared API artifacts exist under `shared-api/`, and the CI/CD path now proves all nine deployable service images can be handed to GitOps.
- Current test: Validate docs against implemented service contracts, generated proto files, JSON event schemas, Kustomize/Gateway routing, and current deploy-handoff evidence.
- Next test: Re-check all architecture docs after GKE/edge provisioning so diagrams and evidence match real GCP/AWS resources.

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

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Added shared gRPC proto contracts and Pub/Sub JSON schemas under `shared-api/`; validated with `protoc` and `jq`. |
| 2026-06-04 | Extracted Project Service public REST OpenAPI contract from `module_project` and frontend call sites; validated YAML parse. |
| 2026-06-04 | Updated Redis, API, service discovery, and Pub/Sub docs as implementation discoveries landed. |
| 2026-06-05 | Rephrased tracker for Codex-only non-service ownership. |
| 2026-06-05 | Confirmed deployment docs now have matching evidence for Artifact Registry image handoff and dev Kustomize references across all implemented services. |
