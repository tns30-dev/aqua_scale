# Edge And Frontend Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED, DESIGN_ONLY

## Summary

- Ownership: Codex owns frontend deployment, CDN, public API edge, Cloud Armor, WSS endpoint, and frontend-to-service integration.
- Current state: Local gateway route rehearsal and frontend Java-service wiring are in progress. Dev-managed Kustomize points backend services to Artifact Registry images, GKE Gateway API classes are available, Argo CD has a healthy managed-backed rollout, and the internal business smoke passed. Public Gateway/LB/WSS and Firebase Hosting are not deployed.
- Current test: Frontend tests/build, Kustomize render for Gateway/HTTPRoute manifests, all-service image substitution, GKE GatewayClass discovery, Argo CD managed runtime sync, internal service readiness, and managed business smoke prerequisite.
- Next test: After AWS IoT/Lambda bridge evidence, provision Gateway/LB/WSS edge and Firebase preview/staging.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Firebase Hosting | TODO | Frontend hosting workflow exists but deploy jobs skip until Firebase service account and project vars are configured. | `../../.github/workflows/frontend-ci-cd.yml`, `../main/frontend_deployment.md` | 2026-06-04 |
| Frontend integration | IN_PROGRESS | Identity, notification, realtime, analytics, pond/cycle/treatment/comparison adapters are wired to Java service contracts. Some local e2e gaps remain unowned by services: feature-access/action-controls, project summary, legacy pond historical. | `../../frontend/src/services/api.service.ts`, `../../frontend/src/test/services/api.service.test.ts`, `../../docs/evidence/frontend-analytics/2026-06-04-analytics-wiring.md` | 2026-06-04 |
| CDN | TODO | Firebase Hosting CDN remains selected for frontend. Cloud CDN only applies if backend static assets are later introduced. | `../main/cdn.md` | 2026-06-05 |
| GCP API edge | IN_PROGRESS | Gateway API and HTTPRoute skeleton route `/api/**` and `/ws` to implemented services; GKE GatewayClasses are live. Cloud LB is deferred until a domain/TLS choice and runtime-scope decision are made. | `../../k8s/base/edge/`, `../../k8s/overlays/dev/kustomization.yaml`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md`, `../../docs/evidence/gitops/2026-06-05-argocd-dev-smoke-rollout.md` | 2026-06-05 |
| Cloud Armor | DESIGN_ONLY | WAF/rate-limit control remains in architecture docs, but runtime implementation/evidence is out of current scope. Dev Terraform keeps the policy disabled. | `../../infra/modules/security/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md`, `../main/api_gateway.md`, `../main/network_security.md` | 2026-06-05 |
| WSS realtime endpoint | IN_PROGRESS | `/ws` route points to `realtime-gateway:8088`; public endpoint target remains `wss://api.aquashield.example.com/ws`. | `../../k8s/base/edge/http-route.yaml`, `../../docs/evidence/k8s-realtime-gateway/2026-06-04-realtime-gateway-kustomize-validation.md` | 2026-06-04 |

## Validation

| Check | Result | Updated |
|---|---|---|
| Frontend tests/build | PASS in existing evidence for Java API wiring. | 2026-06-04 |
| `kubectl kustomize k8s/overlays/dev` | PASS in K8s evidence. | 2026-06-04 |
| `kubectl kustomize k8s/overlays/staging` | PASS in K8s evidence. | 2026-06-04 |
| Tracker ownership rewrite | PASS; edge/frontend is Codex-owned. | 2026-06-05 |
| Dev-managed image substitution | PASS; analytics resolves to Artifact Registry tag `783c78a16381`, and the eight Java services resolve to tag `bef15c6`. | 2026-06-05 |
| GKE Gateway API availability | PASS; GKE GatewayClasses are present and accepted. | 2026-06-05 |
| Istio and Argo runtime prerequisite | PASS; Istio and Argo CD are installed, and the managed-backed nine-service dev runtime is `Synced/Healthy`. | 2026-06-05 |
| Managed business smoke prerequisite | PASS; internal API flows passed through service port-forwards before public edge rollout. | 2026-06-05 |
| Public edge rollout | PENDING; no public Gateway/LB/TLS endpoint has been provisioned yet. | 2026-06-05 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Added Gateway API skeleton and route table for Identity, Project, Pond, Sensor, Notification, Analytics, Audit, and Realtime Gateway. |
| 2026-06-04 | Wired frontend adapters to implemented Java/TS service routes and validated with frontend tests, lint, and build. |
| 2026-06-04 | Updated `/ws` and `/api/audit` edge routes to implemented services. |
| 2026-06-05 | Rephrased tracker for Codex-only non-service ownership. |
| 2026-06-05 | All-service Artifact Registry backfill updated the dev overlay; edge deployment is now waiting on GKE/Gateway/LB runtime resources. |
| 2026-06-05 | GKE runtime foundation is live, Gateway API is available, and Argo CD managed-runtime sync is healthy. Public edge rollout is now gated by domain/TLS, not by missing Istio/Argo or data-runtime prerequisites. |
| 2026-06-05 | Managed-backed business smoke passed internally; public edge/Firebase work now follows the AWS IoT/Lambda bridge slice. |
