# API Gateway Implementation Checklist

## Target

| Item | Selection |
|---|---|
| Edge entry | GCP External Application Load Balancer |
| Kubernetes routing | GKE Gateway API or GKE Ingress |
| Protection | Cloud Armor WAF and rate limiting |
| TLS | Google-managed certificate |
| Public API style | REST/JSON |
| Internal service calls | gRPC inside the cluster |
| BFF | Not required for first implementation |
| Frontend hosting | Firebase Hosting on separate frontend domain |

## Route Checklist

| Status | Route Group | Backend Target | Notes |
|---|---|---|---|
| [ ] | `/api/auth/**` | Identity and Access Service | Login, refresh, logout, profile |
| [ ] | `/api/users/**` | Identity and Access Service | Admin user management |
| [ ] | `/api/projects/**` | Project Service | Project, profile, parameter settings |
| [ ] | `/api/ponds/**` | Pond Service | Pond and cycle operations |
| [ ] | `/api/sensors/**` | Sensor Service | Device, sensor, port mapping |
| [ ] | `/api/alerts/**` | Notification Service | Alert lifecycle and history |
| [ ] | `/api/analytics/**` | Analytics Service | Charts, comparison, summaries |
| [ ] | `/api/audit/**` | Audit Service | Admin audit queries |
| [ ] | `/ws` | Realtime Gateway | WebSocket upgrade path |

## Infrastructure Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Create global external HTTPS load balancer | Public backend API/WS endpoint |
| [ ] | Configure backend API domain | API and WebSocket domain |
| [ ] | Configure GKE Gateway or Ingress | Routes to Kubernetes services |
| [ ] | Configure managed TLS certificate | Valid HTTPS certificate |
| [ ] | Configure Cloud Armor policy | WAF and rate-limit policy |
| [ ] | Configure non-cacheable API paths | `/api/**` and `/ws` excluded from CDN cache |
| [ ] | Add health check endpoints | Backend service health checks pass |
| [ ] | Add access logs | Request log evidence |
| [ ] | Add request ID propagation | `X-Request-Id` or trace context reaches services |
| [ ] | Add CORS rules | Frontend origin allowed, unknown origins blocked |
| [ ] | Allow Firebase frontend origin | Firebase-hosted React app can call APIs |

## Security Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Enforce HTTPS only | HTTP redirects or blocked |
| [ ] | Validate JWT on service endpoints | Protected APIs reject unauthenticated calls |
| [ ] | Add Cloud Armor rate limits | Abuse protection evidence |
| [ ] | Block invalid origins where applicable | Origin control evidence |
| [ ] | Keep internal services private | No direct public service exposure |
| [ ] | Propagate user identity to services | Auth claims or internal auth context |

## Evidence Checklist

| Status | Evidence | File/Location |
|---|---|---|
| [ ] | Load balancer screenshot | Cloud Console |
| [ ] | Gateway/Ingress manifest | `k8s` |
| [ ] | Cloud Armor policy screenshot | Cloud Console |
| [ ] | TLS certificate screenshot | Cloud Console |
| [ ] | Successful API call through gateway | API test output |
| [ ] | Successful API call from Firebase frontend | Browser/network proof |
| [ ] | Blocked/rate-limited request example | Security test output |

## Considerations

| Topic | Guidance |
|---|---|
| Frontend hosting | The React frontend is hosted on Firebase Hosting, not served by this API gateway. |
| Gateway responsibility | This gateway owns backend REST and WebSocket routing only. |
| CORS/origin | API and WebSocket origin policy must explicitly allow the Firebase frontend domain. |
| JWT validation | Validate JWT signature, issuer, audience, expiry, and token type locally at the gateway/service layer. Do not call Identity and Access Service for every request just to validate the token. |
| Gateway authorization scope | Keep gateway authorization coarse-grained: authenticated vs unauthenticated route, valid token, route-level protection, origin control, and abuse protection. |
| Deep authorization | Project, pond, device, feature, and action-level authorization belongs to the owning backend service. Sensitive checks can call Identity and Access Service through internal gRPC. |
| Identity service calls | Identity and Access Service should be called directly for login, refresh, logout, profile, user management, role management, and explicit authorization checks, not for every normal API request. |
| JWT claim shape | Keep JWT compact: user id, role/type summary, tenant/project summary if needed, permission version, `jti`, issuer, audience, and expiry. Do not place the full permission matrix in the token. |
| Redis authorization snapshot | Detailed feature access and ACL snapshots should live in Redis/Memorystore with TTL and versioning. Services use the snapshot for normal authorization checks, with Cloud SQL remaining the source of truth. |
| Token revocation | Use short-lived access tokens. Store revoked `jti` values in Redis until token expiry when logout or forced revocation needs to take effect before natural expiry. |
| Refresh token handling | Refresh token rotation and reuse detection are handled by Identity and Access Service, backed by Redis/Memorystore. The gateway only routes the refresh/logout calls and preserves secure cookie behavior if cookies are used. |
| WebSocket auth | `/ws/token` is a normal authenticated REST route. `/ws` is only the upgrade route; first-frame `AUTH`, WS token validation, replay protection, and subscription authorization are handled by the Realtime Gateway. |
| Internal traffic | Service-to-service gRPC traffic stays inside the cluster and is protected by Kubernetes service identity, Istio mTLS, and AuthorizationPolicy, not by the public API gateway. |
