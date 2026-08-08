# Browser Auth Cookie Hardening

## Source Feature

The updated monolith migrated browser authentication toward HttpOnly JWT cookies,
CSRF bootstrap, and in-memory session hydration. Tokens no longer live in JavaScript
storage in the source frontend.

## Source Files

- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_user/views.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_user/authentication.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/config/settings/base.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/services/api.service.ts`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/utils/auth.ts`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/context/SessionContext.tsx`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/test/services/api.service.test.ts`

## Target Ownership

- `identity-access-service`: login, refresh, logout, cookie issuance, CSRF if adopted.
- API edge/frontend hosting: same-site or CORS/cookie policy.
- `realtime-gateway`: WebSocket token minting or cookie-aware auth decision.
- `frontend`: API client token handling and session storage removal.

## Current Target Gap

Resolved in the first hardening slice. Browser credentials are no longer written to
`sessionStorage`; the SPA authenticates through HttpOnly `access_token` / `refresh_token`
cookies plus a readable `csrftoken` double-submit cookie.

## Microservice Translation Notes

- The first-round realtime gateway intentionally uses `/ws/token` plus first-frame `AUTH`.
  This was preserved; only the `/ws/token` mint route became cookie-aware.
- Header bearer tokens remain supported for scripts, backend tests, and the loadtest
  clients. Cookie auth is additive and browser-first.
- CSRF is enforced only for unsafe requests authenticated from cookies. Explicit bearer
  requests do not require CSRF.
- `/api/csrf` sets the readable CSRF cookie and also returns `csrfToken` in the JSON
  body so cross-subdomain frontend/API deployments can keep the token in memory when
  `document.cookie` cannot see the API-domain cookie.
- Local frontend defaults now use the Vite same-origin proxy to the local gateway.

## Target Files Changed

- `common/src/main/java/com/aquashield/common/security/BrowserAuth.java`
- `identity-access-service/src/main/java/com/aquashield/identity/api/AuthController.java`
- `identity-access-service/src/main/java/com/aquashield/identity/api/AuthCookieSupport.java`
- `identity-access-service/src/main/java/com/aquashield/identity/api/CsrfController.java`
- `identity-access-service/src/main/java/com/aquashield/identity/config/JwtAuthFilter.java`
- `project-service`, `pond-service`, `sensor-service`, `notification-service`, `audit-service`
  `SnapshotAuthFilter.java`
- `realtime-gateway/src/main/java/com/aquashield/realtime/ws/TokenController.java`
- `analytics-service/src/auth/auth.ts`
- `frontend/src/services/api.service.ts`
- `frontend/src/context/SessionContext.tsx`
- `frontend/src/utils/auth.ts`
- `k8s/base/services/api-edge-proxy/configmap.yaml`
- `k8s/base/edge/http-route.yaml`
- `local/gateway/nginx.conf`

## Verification

- Passed: `mvn -pl common,identity-access-service,project-service,sensor-service,notification-service,pond-service,audit-service,realtime-gateway -am -DskipTests compile`
- Passed: `mvn -pl common -Dtest=BrowserAuthTest test`
- Passed: `mvn -pl identity-access-service -am -DskipTests test-compile`
- Passed: `npm test -- --run src/test/services/api.service.test.ts` in `frontend/`
- Passed: `npm run build` in `frontend/`
- Passed: `npm run lint` in `analytics-service/`
- Passed: `npm test -- --run test/api.test.ts` in `analytics-service/`
- Passed: `kubectl kustomize k8s/base`
- Passed: `kubectl kustomize k8s/overlays/dev-full`
- Passed: `git diff --check`

## Runtime Follow-Up

- Identity `AuthFlowIT` now has cookie assertions and cookie-refresh coverage, but the
  Testcontainers integration suite was not executed because Docker is not running locally.
- Full browser login/refresh/logout needs a live Docker Compose or GKE runtime after the
  stack is rebuilt.

## Status

Implemented: first browser-auth hardening slice synced into the microservice target.
