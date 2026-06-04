# Architecture And Contracts Tracker - Codex

Last updated: 2026-06-04

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary for Claude

- Current focus: Shared API contract foundation is available under `shared-api/`.
- Last completed: Project Service domain event schemas added and Pub/Sub contract docs updated for `project.created`, `project.updated`, and `project.settings.updated`.
- Blockers / questions: None for documentation. Future updates depend on implementation discoveries.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Target bounded contexts | DONE | Main logical architecture docs prepared. | `../main/logical_arch_docs.md` | 2026-06-04 |
| Logical microservices architecture | DONE | Logical microservices diagram documented. | `../main/logical_arch_docs.md` | 2026-06-04 |
| Physical cloud architecture | DONE | Physical cloud diagram updated with VPC/firewall/data tiers. | `../main/physical_arch_docs.md` | 2026-06-04 |
| Deployment architecture | DONE | Detailed and presentation deployment diagrams documented. | `../main/deployment_docs.md` | 2026-06-04 |
| Event-driven architecture | DONE | Current event scope corrected; Analytics event consumers are future-only; Project Service domain events are included. | `../main/eda.md`, `../main/eda_docs.md` | 2026-06-04 |
| API contract documentation | DONE | API contract doc prepared with monolith parity consideration; Project Service OpenAPI parity contract extracted from Django/frontend. | `../main/api_contract_docs.md`, `../../shared-api/openapi/project-service.v1.yaml`, `../../docs/evidence/contracts/2026-06-04-project-openapi-extraction.md` | 2026-06-04 |
| gRPC contract documentation | DONE | Service discovery documented and initial proto contracts created for Identity, Project, Pond, and Sensor service lookup/support calls. | `../main/api_contract_docs.md`, `../main/service_discovery.md`, `../../shared-api/proto/`, `../../docs/evidence/contracts/2026-06-04-shared-contract-validation.md` | 2026-06-04 |
| Pub/Sub contract documentation | DONE | Topic/subscription/DLQ contracts documented and current event schema files created for the Pub/Sub catalogue, including Project Service domain events. | `../main/pub_sub_contract_docs.md`, `../../shared-api/events/`, `../../docs/evidence/k8s-project-service/2026-06-04-project-kustomize-validation.md` | 2026-06-04 |
| ERD documentation | DONE | ERD documentation placeholder/checklist prepared. | `../main/erd_docs.md` | 2026-06-04 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Added Project Service Pub/Sub schema files and updated main/shared event catalogues to match implemented project event publishing. |
| 2026-06-04 | Extracted Project Service public REST OpenAPI contract from `module_project` and frontend call sites; validated YAML parse. |
| 2026-06-04 | Added shared gRPC proto contracts and Pub/Sub JSON schemas under `shared-api/`; validated with `protoc` and `jq`. |
| 2026-06-04 | Tracker initialized from Codex checklist. Architecture and contract docs are ready for implementation reference. |
