# API Edge CORS Fix - 2026-06-05

## Scope

This evidence records the production browser fix for the Firebase-hosted frontend calling the public API edge across origins.

- Frontend origin: `https://www.aquashield.live`
- Firebase default origin: `https://aerobic-guide-498413-u6.web.app`
- API origin: `https://api.aquashield.live`
- GitOps commit: `85b6bab58622ed9357018deac4dd6ca5f8f8d262`
- Argo CD application: `aquashield-dev`
- Argo CD path: `k8s/overlays/dev-managed-public`

## Symptom

The browser blocked frontend API calls because the API edge did not return CORS headers for the Firebase custom domain:

```text
Origin https://www.aquashield.live is not allowed by Access-Control-Allow-Origin. Status code: 401
Preflight response is not successful. Status code: 403
```

## Change

`api-edge-proxy` now owns public API CORS at the edge:

```nginx
map $http_origin $cors_allow_origin {
  default "";
  "https://www.aquashield.live" $http_origin;
  "https://aerobic-guide-498413-u6.web.app" $http_origin;
}

add_header Access-Control-Allow-Origin $cors_allow_origin always;
add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With, X-Correlation-Id" always;
add_header Access-Control-Expose-Headers "X-Correlation-Id" always;
add_header Vary "Origin" always;

if ($request_method = OPTIONS) {
  return 204;
}
```

The deployment template annotation was bumped to force a new `api-edge-proxy` pod after the ConfigMap changed.

## Validation

Rendered manifest validation:

```text
kubectl kustomize k8s/overlays/dev-managed-public
PASS

kubectl apply --dry-run=server -k k8s/overlays/dev-managed-public
PASS
```

GitHub Actions:

```text
ci run 27007178776
PASS

deploy-handoff run 27007224758
PASS
```

Argo CD and rollout:

```text
kubectl -n argocd get application aquashield-dev
Synced Healthy 85b6bab58622ed9357018deac4dd6ca5f8f8d262

kubectl -n aquashield-dev get deployment api-edge-proxy
config version: 2026-06-05-cors-frontend-origin
ready: 1/1
```

Allowed custom frontend preflight:

```text
curl -i -X OPTIONS https://api.aquashield.live/api/auth/login \
  -H 'Origin: https://www.aquashield.live' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,authorization'

HTTP/2 204
access-control-allow-origin: https://www.aquashield.live
access-control-allow-methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
access-control-allow-headers: Authorization, Content-Type, X-Requested-With, X-Correlation-Id
vary: Origin
```

Allowed Firebase default-site preflight:

```text
curl -i -X OPTIONS https://api.aquashield.live/api/auth/login \
  -H 'Origin: https://aerobic-guide-498413-u6.web.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,authorization'

HTTP/2 204
access-control-allow-origin: https://aerobic-guide-498413-u6.web.app
vary: Origin
```

Unauthenticated session bootstrap still fails closed while returning browser-readable CORS headers:

```text
curl -i https://api.aquashield.live/api/auth/me \
  -H 'Origin: https://www.aquashield.live'

HTTP/2 401
access-control-allow-origin: https://www.aquashield.live
```

Seeded admin login is reachable from the frontend origin:

```text
curl -i -X POST https://api.aquashield.live/api/auth/login \
  -H 'Origin: https://www.aquashield.live' \
  -H 'Content-Type: application/json' \
  --data '{"email":"admin@aquashield.local","password":"AdminBoot123!"}'

HTTP/2 200
access-control-allow-origin: https://www.aquashield.live
```

Unknown origins do not receive an allow-origin header:

```text
curl -i -X OPTIONS https://api.aquashield.live/api/auth/login \
  -H 'Origin: https://evil.example' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,authorization'

HTTP/2 204
access-control-allow-origin: absent
```

## Interpretation

The public frontend and API are separate origins, so CORS belongs at the public edge. The fix lets the Firebase custom domain and default Firebase domain call the API while preserving an allow-list. Unknown origins can still hit the endpoint at the HTTP layer, but browsers do not receive `Access-Control-Allow-Origin`, so cross-origin JavaScript access is blocked.
