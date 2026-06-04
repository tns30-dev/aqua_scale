# Edge And Frontend Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns frontend deployment, CDN, public API edge, Cloud Armor, WSS endpoint, and frontend-to-service integration.
- Current state: Local gateway route rehearsal and frontend Java-service wiring are in progress. Cloud edge and Firebase Hosting are not deployed.
- Current test: Frontend tests/build plus Kustomize render for Gateway/HTTPRoute manifests.
- Next test: Deploy Firebase preview/staging after Firebase project setup, then deploy GKE Gateway/LB with Cloud Armor once the GCP foundation is applied.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Firebase Hosting | TODO | Frontend hosting workflow exists but deploy jobs skip until Firebase service account and project vars are configured. | `../../.github/workflows/frontend-ci-cd.yml`, `../main/frontend_deployment.md` | 2026-06-04 |
| Frontend integration | IN_PROGRESS | Identity, notification, realtime, analytics, pond/cycle/treatment/comparison adapters are wired to Java service contracts. Some local e2e gaps remain unowned by services: feature-access/action-controls, project summary, legacy pond historical. | `../../frontend/src/services/api.service.ts`, `../../frontend/src/test/services/api.service.test.ts`, `../../docs/evidence/frontend-analytics/2026-06-04-analytics-wiring.md` | 2026-06-04 |
| CDN | TODO | Firebase Hosting CDN remains selected for frontend. Cloud CDN only applies if backend static assets are later introduced. | `../main/cdn.md` | 2026-06-05 |
| GCP API edge | IN_PROGRESS | Gateway API and HTTPRoute skeleton route `/api/**` and `/ws` to implemented services; cloud LB is not provisioned yet. | `../../k8s/base/edge/`, `../../docs/evidence/k8s-audit-service/2026-06-04-audit-kustomize-validation.md` | 2026-06-04 |
| Cloud Armor | TODO | Terraform policy scaffold exists in cloud foundation; live policy and attachment pending. | `../../infra/modules/security/`, `../main/api_gateway.md`, `../main/network_security.md` | 2026-06-05 |
| WSS realtime endpoint | IN_PROGRESS | `/ws` route points to `realtime-gateway:8088`; public endpoint target remains `wss://api.aquashield.example.com/ws`. | `../../k8s/base/edge/http-route.yaml`, `../../docs/evidence/k8s-realtime-gateway/2026-06-04-realtime-gateway-kustomize-validation.md` | 2026-06-04 |

## Validation

| Check | Result | Updated |
|---|---|---|
| Frontend tests/build | PASS in existing evidence for Java API wiring. | 2026-06-04 |
| `kubectl kustomize k8s/overlays/dev` | PASS in K8s evidence. | 2026-06-04 |
| `kubectl kustomize k8s/overlays/staging` | PASS in K8s evidence. | 2026-06-04 |
| Tracker ownership rewrite | PASS; edge/frontend is Codex-owned. | 2026-06-05 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Added Gateway API skeleton and route table for Identity, Project, Pond, Sensor, Notification, Analytics, Audit, and Realtime Gateway. |
| 2026-06-04 | Wired frontend adapters to implemented Java/TS service routes and validated with frontend tests, lint, and build. |
| 2026-06-04 | Updated `/ws` and `/api/audit` edge routes to implemented services. |
| 2026-06-05 | Rephrased tracker for Codex-only non-service ownership. |
