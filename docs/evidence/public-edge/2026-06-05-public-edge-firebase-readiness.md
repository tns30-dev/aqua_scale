# Public API Edge and Firebase Readiness - 2026-06-05

Update: this was the initial readiness note before the HTTPS path was selected. The current public edge evidence is `2026-06-05-public-edge-https-ip-reservation.md`; temporary HTTP exposure is no longer the selected path, and the current overlay no longer matches the historical HTTP-only snippets below.

## Scope

Prepared public API edge and Firebase Hosting readiness without exposing the API publicly.

Added:

- `k8s/overlays/dev-managed-public/` overlay.
- HTTP-only GKE Gateway for temporary IP-based API evidence.
- HTTPRoute wiring for implemented REST and WebSocket paths.
- GKE `HealthCheckPolicy` resources so the load balancer checks real readiness endpoints instead of `/`.
- Argo Application manifest update in Git from `dev-managed` to `dev-managed-public`.

## Public Edge Manifest Validation

Rendered overlay proof:

```text
kubectl kustomize k8s/overlays/dev-managed-public
PASS

Gateway:
- kind: Gateway
- name: aquashield-api-gateway
- gatewayClassName: gke-l7-global-external-managed
- listener: http

HTTPRoute:
- kind: HTTPRoute
- name: aquashield-api-routes
- parent sectionName: http

HealthCheckPolicy:
- analytics-service -> /healthz
- Java/Spring services -> /actuator/health/readiness
```

Server-side dry run:

```text
kubectl apply --dry-run=server -k k8s/overlays/dev-managed-public
PASS

gateway.gateway.networking.k8s.io/aquashield-api-gateway created (server dry run)
httproute.gateway.networking.k8s.io/aquashield-api-routes created (server dry run)
healthcheckpolicy.networking.gke.io/* created (server dry run)
```

## Live Deployment Status

The overlay is committed to Git, but not applied live.

Current live Argo state after the readiness commit:

```text
path: k8s/overlays/dev-managed
status: Synced Healthy
revision: 23d18a7ffac5278fd1ef4d656c64ee866a4af211
```

Reason live apply is pending:

- The ready overlay is HTTP-only because no real domain/TLS secret is configured yet.
- Exposing the API publicly over HTTP requires explicit temporary-risk approval.
- Safer production-style rollout needs a domain and TLS choice first.

## Firebase Readiness

Frontend Firebase config is present:

```text
frontend/firebase.json
hosting.public = dist
SPA rewrite = /index.html
asset cache headers configured
```

Validation:

```text
npm run lint
PASS with 16 existing warnings and 0 errors.

VITE_API_BASE_URL=http://api-placeholder.local \
VITE_WS_BASE_URL=ws://api-placeholder.local/ws \
npm run build
PASS; frontend/dist generated.

npm run test -- --run
PASS; 10 test files, 103 passed, 8 skipped.
```

Firebase CLI:

```text
firebase --version
15.9.0
```

Live Firebase deploy is pending Firebase project/service-account configuration and the final API/WS base URLs.

## Next Evidence

Current path:

- Use the reserved static IP from `2026-06-05-public-edge-https-ip-reservation.md`.
- Provide the real API domain and create the DNS `A` record.
- Create the managed certificate/TLS config.
- Deploy `dev-managed-public` with the HTTPS listener and HTTP redirect.
- Configure Firebase `VITE_API_BASE_URL` and `VITE_WS_BASE_URL`.
