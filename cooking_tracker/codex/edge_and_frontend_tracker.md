# Edge And Frontend Tracker - Codex

Last updated: 2026-06-05

Status legend: TODO, IN_PROGRESS, DONE, BLOCKED, DESIGN_ONLY

## Summary

- Ownership: Codex owns frontend deployment, CDN, public API edge, Cloud Armor, WSS endpoint, and frontend-to-service integration.
- Current state: Frontend Java-service wiring is in progress and the managed backend runtime is healthy. The public HTTPS API edge is live at `https://api.aquashield.live` on static IP `8.232.154.25` with active Google-managed TLS, GKE Gateway, HTTP-to-HTTPS redirect, `/api` and `/ws` routes through `api-edge-proxy`, healthy GCLB backend, Argo `Synced/Healthy`, and a public business-flow smoke pass. Firebase Hosting is live at `https://aerobic-guide-498413-u6.web.app`, and `www.aquashield.live` host ownership is active while Firebase finishes managed certificate activation.
- Current test: Frontend tests/lint/build, Kustomize render for Gateway/HTTPRoute/proxy manifests, server-side public edge dry run, Terraform validation, static IP reservation, DNS resolution, managed certificate activation, GKE Gateway health, Argo CD public overlay sync, public HTTPS status checks, full public business smoke, Firebase deploy, default Hosting URL checks, SPA route rewrite check, deployed asset endpoint verification, and custom-domain DNS checks.
- Next test: Wait for Firebase to mark `www.aquashield.live` active, then run DAST/performance evidence.

## Items

| Item | Status | Progress notes | Evidence | Updated |
|---|---|---|---|---|
| Firebase Hosting | DONE | `frontend/firebase.json` and `frontend/.firebaserc` bind Hosting to project `aerobic-guide-498413-u6`. Production build was deployed to `https://aerobic-guide-498413-u6.web.app` with live API/WSS env values; `www.aquashield.live` custom-domain host ownership is active and waits on Firebase certificate activation. | `../../frontend/firebase.json`, `../../frontend/.firebaserc`, `../../.github/workflows/frontend-ci-cd.yml`, `../../docs/evidence/public-edge/2026-06-05-firebase-hosting-live-deploy.md`, `../../docs/evidence/public-edge/2026-06-05-public-edge-live-rollout.md`, `../main/frontend_deployment.md` | 2026-06-05 |
| Frontend integration | DONE | Identity, notification, realtime, analytics, pond/cycle/treatment/comparison adapters are wired to Java service contracts. The deployed Firebase bundle points at `https://api.aquashield.live` and `wss://api.aquashield.live`. | `../../frontend/src/services/api.service.ts`, `../../frontend/src/test/services/api.service.test.ts`, `../../docs/evidence/frontend-analytics/2026-06-04-analytics-wiring.md`, `../../docs/evidence/public-edge/2026-06-05-firebase-hosting-live-deploy.md`, `../../docs/evidence/public-edge/2026-06-05-public-edge-live-rollout.md` | 2026-06-05 |
| CDN | DONE | Firebase Hosting CDN serves the deployed SPA at the default Hosting URL. Custom domain host ownership for `www.aquashield.live` is active; certificate activation remains a Firebase-side wait. Cloud CDN only applies if backend static assets are later introduced. | `../../docs/evidence/public-edge/2026-06-05-firebase-hosting-live-deploy.md`, `../main/cdn.md` | 2026-06-05 |
| GCP API edge | DONE | `https://api.aquashield.live` is live through GKE Gateway and `api-edge-proxy`; DNS resolves to `8.232.154.25`, managed certificate is `ACTIVE`, GCLB backend is `HEALTHY`, Argo is `Synced/Healthy`, and the public business-flow smoke passed. | `../../infra/modules/api-edge/`, `../../k8s/base/services/api-edge-proxy/`, `../../k8s/base/edge/`, `../../k8s/overlays/dev-managed-public/`, `../../docs/evidence/public-edge/2026-06-05-public-edge-live-rollout.md` | 2026-06-05 |
| Cloud Armor | DESIGN_ONLY | WAF/rate-limit control remains in architecture docs, but runtime implementation/evidence is out of current scope. Dev Terraform keeps the policy disabled. | `../../infra/modules/security/`, `../../docs/evidence/terraform-foundation/2026-06-05-gke-runtime-apply.md`, `../main/api_gateway.md`, `../main/network_security.md` | 2026-06-05 |
| WSS realtime endpoint | DONE | `/ws` is publicly routed through `api-edge-proxy` to `realtime-gateway`; smoke proved realtime token minting through the public edge. Frontend should use `wss://api.aquashield.live`. | `../../k8s/base/services/api-edge-proxy/configmap.yaml`, `../../k8s/overlays/dev-managed-public/`, `../../docs/evidence/public-edge/2026-06-05-public-edge-live-rollout.md` | 2026-06-05 |

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
| Public edge rollout | PASS; `https://api.aquashield.live` is live on static IP `8.232.154.25`, with active managed cert, HTTP redirect, healthy GCLB backend, and Argo `Synced/Healthy` on revision `960e98f`. | 2026-06-05 |
| Public edge manifest readiness | PASS; `kubectl kustomize k8s/overlays/dev-managed-public` and `kubectl apply --dry-run=server -k k8s/overlays/dev-managed-public` pass. | 2026-06-05 |
| Public edge static IP | PASS; Terraform applied `google_compute_global_address` `aquashield-dev-api-edge` with `1 added, 0 changed, 0 destroyed`; output IP is `8.232.154.25`. | 2026-06-05 |
| Public edge business smoke | PASS; public HTTPS smoke produced `energyTotalKwh=3.1`, `activeAlerts=1`, `comparisonMetricCount=4`, `realtimeTokenMinted=true`, and `auditSecurityRows=6`. | 2026-06-05 |
| Firebase static readiness | PASS; frontend lint, Vitest suite, and production build pass. | 2026-06-05 |
| Firebase Hosting deploy | PASS; deployed version `e3363fbcc53afb20` to `https://aerobic-guide-498413-u6.web.app`, default URL and `/login` route return HTTP 200, and the deployed asset contains the live API/WSS endpoints. | 2026-06-05 |
| Firebase custom-domain activation | PARTIAL; `www.aquashield.live` CNAME and `_acme-challenge.www.aquashield.live` TXT records resolve locally and through `8.8.8.8`; Firebase reports `HOST_ACTIVE` and `OWNERSHIP_ACTIVE`, with certificate validation pending. | 2026-06-05 |

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
| 2026-06-05 | Switched to the HTTPS path, added `api-edge-proxy`, reserved global static IP `8.232.154.25`, and at that point left live Gateway/Firebase deploy gated only by real domain/DNS/managed certificate. |
| 2026-06-05 | Configured `api.aquashield.live`, created the managed certificate, synced `dev-managed-public` through Argo, fixed GCLB/mTLS and Nginx mesh upstream issues, and passed the public HTTPS business-flow smoke. |
| 2026-06-05 | Deployed the React/Vite SPA to Firebase Hosting with live API/WSS env values, added `.firebaserc`, verified the default Hosting URL and SPA rewrite, and activated `www.aquashield.live` host ownership while Firebase certificate validation remains pending. |
