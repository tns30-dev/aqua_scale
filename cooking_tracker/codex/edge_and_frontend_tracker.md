# Edge And Frontend Tracker - Codex

Last updated: 2026-06-04

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary for Claude

- Current focus: Backend edge skeleton is available for service integration.
- Last completed: Project Service REST route now targets the implemented service port and includes catalogue parity endpoints.
- Blockers / questions: Real frontend deployment needs Firebase project/domain. Real GCP edge needs domain/certificate and cluster/Gateway controller.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Firebase Hosting | TODO | Frontend hosting not deployed. | `../main/frontend_deployment.md` | — |
| CDN | TODO | Firebase CDN remains the selected frontend CDN; no cloud deployment yet. | `../main/cdn.md` | — |
| GCP API edge | IN_PROGRESS | Gateway API and HTTPRoute skeleton created for `/api/**` routes; Identity targets `8081`; Project and catalogue endpoints target `8082`. Cloud LB is not provisioned yet. | `../../k8s/base/edge/`, `../../docs/evidence/k8s-project-service/2026-06-04-project-kustomize-validation.md` | 2026-06-04 |
| Cloud Armor | TODO | Policy not provisioned. Will be Terraform/GCP work after project details are available. | `../main/api_gateway.md`, `../main/network_security.md` | — |
| WSS realtime endpoint | IN_PROGRESS | `/ws` route points to `realtime-gateway:8080`; public endpoint remains `wss://api.aquashield.example.com/ws`. | `../../k8s/base/edge/http-route.yaml`, `../main/websocket.md` | 2026-06-04 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Updated Project API and catalogue routes to target `project-service:8082`; validated through dev/staging overlays. |
| 2026-06-04 | Updated Identity API routes to target the implemented service port `8081` and validated through dev/staging overlays. |
| 2026-06-04 | Repo flattened to root layout; edge manifest paths updated to root `k8s` and validated through the dev/staging overlays. |
| 2026-06-04 | Added Gateway API skeleton and route table for Identity, Project, Pond, Sensor, Notification, Analytics, Audit, and Realtime Gateway. |
