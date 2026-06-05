# Edge And Frontend Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED

## Summary

- Ownership: Codex owns frontend deployment, CDN, public API edge, Cloud Armor, WSS endpoint, and frontend-to-service integration.
- Current state: Local gateway route rehearsal and frontend Java-service wiring are in progress. Dev Kustomize points all nine backend services to Artifact Registry images, and GKE Gateway API classes are available on the live cluster. Public Gateway/LB/WSS and Firebase Hosting are not deployed.
- Current test: Frontend tests/build, Kustomize render for Gateway/HTTPRoute manifests, all-service image substitution, GKE GatewayClass discovery, and live-cluster dry-run preflight.
- Next test: Install Istio or split mesh resources, then sync the dev overlay through Argo CD and provision Gateway/LB/WSS edge. Firebase preview/staging remains separate.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Firebase Hosting | TODO | Frontend hosting workflow exists but deploy jobs skip until Firebase service account and project vars are configured. | `../../.github/workflows/frontend-ci-cd.yml`, `../main/frontend_deployment.md` | 2026-06-04 |
| Frontend integration | IN_PROGRESS | Identity, notification, realtime, analytics, pond/cycle/treatment/comparison adapters are wired to Java service contracts. Some local e2e gaps remain unowned by services: feature-access/action-controls, project summary, legacy pond historical. | `../../frontend/src/services/api.service.ts`, `../../frontend/src/test/services/api.service.test.ts`, `../../docs/evidence/frontend-analytics/2026-06-04-analytics-wiring.md` | 2026-06-04 |
| CDN | TODO | Firebase Hosting CDN remains selected for frontend. Cloud CDN only applies if backend static assets are later introduced. | `../main/cdn.md` | 2026-06-05 |
| GCP API edge | IN_PROGRESS | Gateway API and HTTPRoute skeleton route `/api/**` and `/ws` to implemented services; GKE GatewayClasses are live. Cloud LB is not provisioned yet because app sync is gated by Istio CRDs. | `../../k8s/base/edge/`, `../../k8s/overlays/dev/kustomization.yaml`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md` | 2026-06-05 |
| Cloud Armor | BLOCKED | Project has zero Cloud Armor policy/rule quota; dev Terraform disables the policy until quota is granted. | `../../infra/modules/security/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md`, `../main/api_gateway.md`, `../main/network_security.md` | 2026-06-05 |
| WSS realtime endpoint | IN_PROGRESS | `/ws` route points to `realtime-gateway:8088`; public endpoint target remains `wss://api.aquashield.example.com/ws`. | `../../k8s/base/edge/http-route.yaml`, `../../docs/evidence/k8s-realtime-gateway/2026-06-04-realtime-gateway-kustomize-validation.md` | 2026-06-04 |

## Validation

| Check | Result | Updated |
|---|---|---|
| Frontend tests/build | PASS in existing evidence for Java API wiring. | 2026-06-04 |
| `kubectl kustomize k8s/overlays/dev` | PASS in K8s evidence. | 2026-06-04 |
| `kubectl kustomize k8s/overlays/staging` | PASS in K8s evidence. | 2026-06-04 |
| Tracker ownership rewrite | PASS; edge/frontend is Codex-owned. | 2026-06-05 |
| Dev overlay image substitution | PASS; all nine service images resolve to Artifact Registry tag `783c78a16381`. | 2026-06-05 |
| GKE Gateway API availability | PASS; GKE GatewayClasses are present and accepted. | 2026-06-05 |
| Dev overlay live preflight | BLOCKED; Istio CRDs are missing for mesh resources in the overlay. | 2026-06-05 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Added Gateway API skeleton and route table for Identity, Project, Pond, Sensor, Notification, Analytics, Audit, and Realtime Gateway. |
| 2026-06-04 | Wired frontend adapters to implemented Java/TS service routes and validated with frontend tests, lint, and build. |
| 2026-06-04 | Updated `/ws` and `/api/audit` edge routes to implemented services. |
| 2026-06-05 | Rephrased tracker for Codex-only non-service ownership. |
| 2026-06-05 | All-service Artifact Registry backfill updated the dev overlay; edge deployment is now waiting on GKE/Gateway/LB runtime resources. |
| 2026-06-05 | GKE runtime foundation is live and Gateway API is available. Public edge rollout is gated by Istio CRDs and then Argo CD sync. |
