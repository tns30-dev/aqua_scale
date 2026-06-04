# Architecture And Contracts Tracker - Codex

Last updated: 2026-06-04

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary for Claude

- Current focus: Architecture/contract documentation is prepared in `cooking_tracker/main`.
- Last completed: Main architecture docs and Codex-scoped checklist were split from the master checklist.
- Blockers / questions: None for documentation. Future updates depend on implementation discoveries.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Target bounded contexts | DONE | Main logical architecture docs prepared. | `../main/logical_arch_docs.md` | 2026-06-04 |
| Logical microservices architecture | DONE | Logical microservices diagram documented. | `../main/logical_arch_docs.md` | 2026-06-04 |
| Physical cloud architecture | DONE | Physical cloud diagram updated with VPC/firewall/data tiers. | `../main/physical_arch_docs.md` | 2026-06-04 |
| Deployment architecture | DONE | Detailed and presentation deployment diagrams documented. | `../main/deployment_docs.md` | 2026-06-04 |
| Event-driven architecture | DONE | Current event scope corrected; Analytics event consumers are future-only. | `../main/eda.md`, `../main/eda_docs.md` | 2026-06-04 |
| API contract documentation | DONE | API contract doc prepared with monolith parity consideration. | `../main/api_contract_docs.md` | 2026-06-04 |
| gRPC contract documentation | DONE | Service discovery and contract mapping documented. | `../main/api_contract_docs.md`, `../main/service_discovery.md` | 2026-06-04 |
| Pub/Sub contract documentation | DONE | Topic/subscription/DLQ contracts prepared. | `../main/pub_sub_contract_docs.md` | 2026-06-04 |
| ERD documentation | DONE | ERD documentation placeholder/checklist prepared. | `../main/erd_docs.md` | 2026-06-04 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Tracker initialized from Codex checklist. Architecture and contract docs are ready for implementation reference. |
