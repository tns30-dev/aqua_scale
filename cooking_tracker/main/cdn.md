# CDN Implementation Checklist

## Target

| Item | Selection |
|---|---|
| Frontend static CDN | Firebase Hosting CDN |
| Backend edge CDN | GCP Cloud CDN only if a GCP static/backend bucket is added |
| Attachment point for backend | External Application Load Balancer |
| Static asset source | Firebase Hosting for the React SPA |
| Optional future provider | Cloudflare global CDN/WAF |

## Cache Policy Checklist

| Status | Asset/Path | Cache Rule |
|---|---|---|
| [ ] | Hashed JS bundles | Long TTL, immutable |
| [ ] | Hashed CSS bundles | Long TTL, immutable |
| [ ] | Public images/icons | Long TTL where safe |
| [ ] | Public docs/demo assets | Cache if not user-specific |
| [ ] | Backend `/api/**` | No cache |
| [ ] | Backend `/ws` | No cache |
| [ ] | Auth/session responses | No cache |
| [ ] | User/project/pond data | No cache unless explicitly public |

## Implementation Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Build frontend with hashed filenames | Immutable static artifacts |
| [ ] | Deploy frontend to Firebase Hosting | Frontend CDN enabled |
| [ ] | Set cache headers for static assets | Correct `Cache-Control` |
| [ ] | Set no-store headers for API responses | API response cache safety |
| [ ] | Keep frontend and backend domains separate for first implementation | Simpler routing |
| [ ] | Add invalidation process | Controlled cache purge command |
| [ ] | Add access log visibility | CDN request evidence |

## Evidence Checklist

| Status | Evidence | Expected Result |
|---|---|---|
| [ ] | Static asset response headers | CDN/cache headers visible |
| [ ] | API response headers | `no-store` or private cache policy |
| [ ] | Firebase Hosting screenshot | Frontend CDN/hosting evidence |
| [ ] | Frontend loads through HTTPS | Browser/network proof |
| [ ] | Cache hit proof if available | CDN log or header evidence |

## Considerations

| Topic | Guidance |
|---|---|
| Frontend CDN | Firebase Hosting is the selected frontend static delivery path. |
| GCP Cloud CDN | Use GCP Cloud CDN only for backend-attached static assets or future same-domain edge routing. |
| API safety | Backend `/api/**` and `/ws` must remain non-cacheable. |
| Domain model | First implementation uses separate Firebase frontend and backend API/WebSocket domains. |
