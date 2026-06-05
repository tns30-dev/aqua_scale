# Edge And Frontend Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED, DESIGN_ONLY

## Summary

- Ownership: Codex owns frontend deployment, CDN, public API edge, Cloud Armor, WSS endpoint, and frontend-to-service integration.
- Current state: Frontend Java-service wiring is in progress and the managed backend runtime is healthy. `dev-managed-public` now renders the HTTPS public edge shape: GKE Gateway with static address `8.232.154.25`, HTTP-to-HTTPS redirect, pre-shared managed certificate name, `/api` and `/ws` routes to an in-cluster `api-edge-proxy`, and a proxy health check. Public Gateway/LB/WSS and Firebase Hosting are not deployed live yet because the real API domain/DNS/certificate are still pending.
- Current test: Frontend tests/lint/build, Kustomize render for Gateway/HTTPRoute/proxy manifests, server-side public edge dry run, Terraform validation, static IP reservation, GKE GatewayClass discovery, Argo CD managed runtime sync, internal service readiness, and managed business smoke prerequisite.
- Next test: Choose the real API hostname, point DNS at `8.232.154.25`, create the managed certificate, then deploy Gateway/LB/WSS edge and Firebase preview/staging.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Firebase Hosting | IN_PROGRESS | `frontend/firebase.json` is ready and frontend lint/tests/build pass for deployment-style env values. Live deploy waits on Firebase project/service account plus final HTTPS API and WSS URLs. | `../../frontend/firebase.json`, `../../.github/workflows/frontend-ci-cd.yml`, `../../docs/evidence/public-edge/2026-06-05-public-edge-firebase-readiness.md`, `../../docs/evidence/public-edge/2026-06-05-public-edge-https-ip-reservation.md`, `../main/frontend_deployment.md` | 2026-06-05 |
| Frontend integration | IN_PROGRESS | Identity, notification, realtime, analytics, pond/cycle/treatment/comparison adapters are wired to Java service contracts. Some local e2e gaps remain unowned by services: feature-access/action-controls, project summary, legacy pond historical. | `../../frontend/src/services/api.service.ts`, `../../frontend/src/test/services/api.service.test.ts`, `../../docs/evidence/frontend-analytics/2026-06-04-analytics-wiring.md` | 2026-06-04 |
| CDN | TODO | Firebase Hosting CDN remains selected for frontend. Cloud CDN only applies if backend static assets are later introduced. | `../main/cdn.md` | 2026-06-05 |
| GCP API edge | IN_PROGRESS | `dev-managed-public` overlay now models the HTTPS path: static named address, HTTP redirect, managed-cert pre-shared certificate name, proxy-backed `/api` and `/ws` routes, and proxy health check. Terraform reserved global IP `8.232.154.25`; live Gateway apply waits on real domain/DNS/cert. | `../../infra/modules/api-edge/`, `../../k8s/base/services/api-edge-proxy/`, `../../k8s/base/edge/`, `../../k8s/overlays/dev-managed-public/`, `../../docs/evidence/public-edge/2026-06-05-public-edge-https-ip-reservation.md` | 2026-06-05 |
| Cloud Armor | DESIGN_ONLY | WAF/rate-limit control remains in architecture docs, but runtime implementation/evidence is out of current scope. Dev Terraform keeps the policy disabled. | `../../infra/modules/security/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md`, `../main/api_gateway.md`, `../main/network_security.md` | 2026-06-05 |
| WSS realtime endpoint | IN_PROGRESS | `/ws` reaches `realtime-gateway` through `api-edge-proxy`; final `wss://<api-domain>/ws` waits on real domain, DNS, managed certificate, and live Gateway sync. | `../../k8s/base/services/api-edge-proxy/configmap.yaml`, `../../k8s/overlays/dev-managed-public/`, `../../docs/evidence/public-edge/2026-06-05-public-edge-https-ip-reservation.md` | 2026-06-05 |

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
| Public edge rollout | PARTIAL; Terraform reserved global static IP `8.232.154.25`, but the Gateway/LB/TLS endpoint is not live until DNS and managed certificate are ready. | 2026-06-05 |
| Public edge manifest readiness | PASS; `kubectl kustomize k8s/overlays/dev-managed-public` and `kubectl apply --dry-run=server -k k8s/overlays/dev-managed-public` pass. | 2026-06-05 |
| Public edge static IP | PASS; Terraform applied `google_compute_global_address` `aquashield-dev-api-edge` with `1 added, 0 changed, 0 destroyed`; output IP is `8.232.154.25`. | 2026-06-05 |
| Firebase static readiness | PASS; frontend lint, Vitest suite, and production build pass. | 2026-06-05 |

## Log

| Date | Update |
|---|---|
| 2026-06-04 | Added Gateway API skeleton and route table for Identity, Project, Pond, Sensor, Notification, Analytics, Audit, and Realtime Gateway. |
| 2026-06-04 | Wired frontend adapters to implemented Java/TS service routes and validated with frontend tests, lint, and build. |
| 2026-06-04 | Updated `/ws` and `/api/audit` edge routes to implemented services. |
| 2026-06-05 | Rephrased tracker for Codex-only non-service ownership. |
| 2026-06-05 | All-service Artifact Registry backfill updated the dev overlay; edge deployment is now waiting on GKE/Gateway/LB runtime resources. |
| 2026-06-05 | GKE runtime foundation is live, Gateway API is available, and Argo CD managed-runtime sync is healthy. Public edge rollout is now gated by domain/TLS, not by missing Istio/Argo or data-runtime prerequisites. |
| 2026-06-05 | Managed-backed business smoke passed internally; AWS IoT/Lambda bridge is now live, so public edge/Firebase is the next deployment slice. |
| 2026-06-05 | Added `dev-managed-public` Gateway overlay and Firebase readiness evidence. Live HTTP Gateway apply requires explicit approval or a domain/TLS path. |
| 2026-06-05 | Switched to the HTTPS path, added `api-edge-proxy`, reserved global static IP `8.232.154.25`, and left live Gateway/Firebase deploy gated only by real domain/DNS/managed certificate. |
