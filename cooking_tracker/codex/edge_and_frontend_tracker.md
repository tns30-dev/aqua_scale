# Edge And Frontend Tracker - Codex

Last updated: 2026-06-04

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary for Claude

- Current focus: Frontend is being wired incrementally to implemented Java services.
- Last completed: Notification alert route now targets the implemented service port `8087`.
- Blockers / questions: Real frontend deployment needs Firebase project/domain. Real GCP edge needs domain/certificate and cluster/Gateway controller.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Firebase Hosting | TODO | Frontend hosting not deployed. | `../main/frontend_deployment.md` | — |
| CDN | TODO | Firebase CDN remains the selected frontend CDN; no cloud deployment yet. | `../main/cdn.md` | — |
| GCP API edge | IN_PROGRESS | Gateway API and HTTPRoute skeleton created for `/api/**` routes; Identity targets `8081`; Project/catalogue endpoints target `8082`; Sensor endpoints target `8083`; Notification alert endpoints target `8087`. Cloud LB is not provisioned yet. | `../../k8s/base/edge/`, `../../docs/evidence/k8s-notification-service/2026-06-04-notification-kustomize-validation.md` | 2026-06-04 |
| Cloud Armor | TODO | Policy not provisioned. Will be Terraform/GCP work after project details are available. | `../main/api_gateway.md`, `../main/network_security.md` | — |
| WSS realtime endpoint | IN_PROGRESS | `/ws` route points to `realtime-gateway:8080`; public endpoint remains `wss://api.aquashield.example.com/ws`. | `../../k8s/base/edge/http-route.yaml`, `../main/websocket.md` | 2026-06-04 |
| Frontend Java API wiring | IN_PROGRESS | Identity/user-management adapter uses bearer auth and Java endpoints; access read responses are enriched from `/api/users` for display fields; onboarding includes `mobileNumber`. Project/Sensor client methods are already present; Pond/Realtime/Analytics remain pending backend readiness. | `../../frontend/src/services/api.service.ts`, `../../frontend/src/components/user-management/OnboardUserDialog.tsx`, `../../frontend/src/test/services/api.service.test.ts` | 2026-06-04 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Updated Notification alert route `/api/alerts` to target `notification-service:8087`; validated through dev/staging overlays. |
| 2026-06-04 | Wired frontend admin/auth adapter to Java Identity contracts: `PATCH /api/users/{id}`, Java access payload mapping, bearer token handling, mobile-number onboarding field; verified with full frontend tests, lint, and build. |
| 2026-06-04 | Updated Sensor API routes to target `sensor-service:8083`, including `/api/sensor-types`, `/api/iot-devices`, `/api/project-sensors`, and nested `/api/projects/{projectId}/sensors`; validated through dev/staging overlays. |
| 2026-06-04 | Updated Project API and catalogue routes to target `project-service:8082`; validated through dev/staging overlays. |
| 2026-06-04 | Updated Identity API routes to target the implemented service port `8081` and validated through dev/staging overlays. |
| 2026-06-04 | Repo flattened to root layout; edge manifest paths updated to root `k8s` and validated through the dev/staging overlays. |
| 2026-06-04 | Added Gateway API skeleton and route table for Identity, Project, Pond, Sensor, Notification, Analytics, Audit, and Realtime Gateway. |
