# Edge And Frontend Tracker - Codex

Last updated: 2026-06-04

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary for Claude

- Current focus: Frontend is being wired incrementally to implemented Java services.
- Last completed: Pond edge routes now target the implemented Pond Service on `8089`.
- Blockers / questions: Real frontend deployment needs Firebase project/domain. Real GCP edge needs domain/certificate and cluster/Gateway controller.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Firebase Hosting | TODO | Frontend hosting not deployed. | `../main/frontend_deployment.md` | — |
| CDN | TODO | Firebase CDN remains the selected frontend CDN; no cloud deployment yet. | `../main/cdn.md` | — |
| GCP API edge | IN_PROGRESS | Gateway API and HTTPRoute skeleton created for `/api/**` routes; Identity targets `8081`; Project/catalogue endpoints target `8082`; Pond/cycle/treatment/comparison endpoints target `8089`; Sensor endpoints target `8083`; Notification alert endpoints target `8087`. Cloud LB is not provisioned yet. | `../../k8s/base/edge/`, `../../docs/evidence/k8s-pond-service/2026-06-04-pond-kustomize-validation.md` | 2026-06-04 |
| Cloud Armor | TODO | Policy not provisioned. Will be Terraform/GCP work after project details are available. | `../main/api_gateway.md`, `../main/network_security.md` | — |
| WSS realtime endpoint | IN_PROGRESS | `/ws` route points to `realtime-gateway:8088`; public endpoint remains `wss://api.aquashield.example.com/ws`; `/ws/token` is covered by the same path prefix. | `../../k8s/base/edge/http-route.yaml`, `../../docs/evidence/k8s-realtime-gateway/2026-06-04-realtime-gateway-kustomize-validation.md` | 2026-06-04 |
| Frontend Java API wiring | IN_PROGRESS | Identity/user-management adapter uses bearer auth and Java endpoints; access read responses are enriched from `/api/users` for display fields; onboarding includes `mobileNumber`. Notification alert routes are slashless Java endpoints; realtime uses `/ws/token` plus `/ws` first-frame `AUTH`. Project/Sensor client methods are present; Pond backend readiness is now unblocked for frontend wiring; Analytics remains pending backend readiness. | `../../frontend/src/services/api.service.ts`, `../../frontend/src/services/websocket.service.ts`, `../../frontend/src/test/services/websocket.service.test.ts` | 2026-06-04 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Updated Pond routes to target `pond-service:8089`, including `/api/ponds`, `/api/cycles`, `/api/treatments`, `/api/pond-treatments`, and nested project routes for create-pond and pond-comparison before the general `/api/projects` route; validated through dev/staging overlays. |
| 2026-06-04 | Replaced Django per-pond WebSocket URLs with a Realtime Gateway frontend adapter: token mint through `/ws/token`, one `/ws` socket, first-frame `AUTH`, uppercase heartbeat, reading fanout to pond callbacks, project-scoped alert frame routing, and slashless Notification alert REST calls; verified with frontend tests, lint, and build. |
| 2026-06-04 | Updated WSS route `/ws` to target `realtime-gateway:8088` and added the gateway workload manifests; validated through dev/staging overlays. |
| 2026-06-04 | Updated Notification alert route `/api/alerts` to target `notification-service:8087`; validated through dev/staging overlays. |
| 2026-06-04 | Wired frontend admin/auth adapter to Java Identity contracts: `PATCH /api/users/{id}`, Java access payload mapping, bearer token handling, mobile-number onboarding field; verified with full frontend tests, lint, and build. |
| 2026-06-04 | Updated Sensor API routes to target `sensor-service:8083`, including `/api/sensor-types`, `/api/iot-devices`, `/api/project-sensors`, and nested `/api/projects/{projectId}/sensors`; validated through dev/staging overlays. |
| 2026-06-04 | Updated Project API and catalogue routes to target `project-service:8082`; validated through dev/staging overlays. |
| 2026-06-04 | Updated Identity API routes to target the implemented service port `8081` and validated through dev/staging overlays. |
| 2026-06-04 | Repo flattened to root layout; edge manifest paths updated to root `k8s` and validated through the dev/staging overlays. |
| 2026-06-04 | Added Gateway API skeleton and route table for Identity, Project, Pond, Sensor, Notification, Analytics, Audit, and Realtime Gateway. |
