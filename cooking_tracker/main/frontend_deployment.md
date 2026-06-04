# Frontend Deployment Checklist

## Target

| Item | Selection |
|---|---|
| Frontend app | React SPA |
| Hosting | Firebase Hosting |
| Deployment option | Option A: separate frontend and backend domains |
| Static delivery | Firebase Hosting CDN |
| Backend API domain | Separate API domain through GCP External Application Load Balancer |
| WebSocket domain | Same backend API domain through GCP External Application Load Balancer |

## Selected Routing Shape

```text
https://aquashield.web.app
  -> Firebase Hosting
  -> React SPA static assets

https://api.aquashield.example.com/api/**
  -> GCP External Application Load Balancer
  -> GKE Gateway/Ingress
  -> backend microservices

wss://api.aquashield.example.com/ws
  -> GCP External Application Load Balancer
  -> GKE Gateway/Ingress
  -> Realtime Gateway
```

## Firebase Hosting Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Create Firebase project or select existing project | Firebase project ready |
| [ ] | Connect frontend app to Firebase project | Firebase config available |
| [ ] | Configure `firebase.json` | Hosting config |
| [ ] | Configure SPA rewrite to `/index.html` | Client-side routing works |
| [ ] | Build React app | Static build output |
| [ ] | Deploy to Firebase Hosting | Public frontend URL |
| [ ] | Configure custom domain if available | Optional production URL |
| [ ] | Configure cache headers for hashed assets | Efficient static delivery |
| [ ] | Keep API base URL configurable | Environment-based backend domain |
| [ ] | Keep WebSocket URL configurable | Environment-based realtime domain |

## Frontend Environment Checklist

| Status | Variable | Purpose |
|---|---|---|
| [ ] | `VITE_API_BASE_URL` or equivalent | Backend REST API base URL |
| [ ] | `VITE_WS_URL` or equivalent | WebSocket URL |
| [ ] | `VITE_FIREBASE_*` if needed | Firebase web app config |
| [ ] | Environment-specific `.env` files | Local/dev/staging config |
| [ ] | CI secret/environment config | Safe frontend deployment config |

## Backend Edge Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Create backend API domain | `api.aquashield.example.com` or demo equivalent |
| [ ] | Configure HTTPS certificate | Backend API TLS |
| [ ] | Configure `/api/**` routing | REST APIs reach GKE services |
| [ ] | Configure `/ws` routing | WebSocket reaches Realtime Gateway |
| [ ] | Configure CORS for Firebase origin | Frontend can call APIs |
| [ ] | Configure allowed WebSocket origins | Firebase origin allowed |
| [ ] | Configure no-cache headers for API responses | API responses not CDN-cached |

## Evidence Checklist

| Status | Evidence | Expected Result |
|---|---|---|
| [ ] | Firebase Hosting deployment screenshot | Frontend deployed |
| [ ] | Public frontend URL | React app loads |
| [ ] | API call from Firebase frontend | REST API succeeds |
| [ ] | WebSocket connection from Firebase frontend | Realtime connection succeeds |
| [ ] | CORS rejection test | Unknown origin blocked |
| [ ] | Frontend environment config screenshot/log | Correct API/WS domains used |

## Considerations

| Topic | Guidance |
|---|---|
| Deployment choice | Use Firebase Hosting because the project owner already has deployment experience with it. |
| Domain strategy | Use separate frontend and backend domains for the first implementation to reduce routing complexity. |
| Frontend hosting | Do not run the React SPA as a GKE pod unless server-side rendering or BFF logic is intentionally added later. |
| API routing | Firebase hosts only the frontend. Backend APIs remain behind the GCP API edge. |
| WebSocket routing | WebSocket traffic should connect to the backend API domain, not Firebase Hosting. |
| CORS | Backend services must explicitly allow the Firebase frontend origin. |
| Config | Do not hardcode API or WebSocket URLs in frontend code; use environment config. |

