# Frontend Implementation Checklist

## Target

| Item | Selection |
|---|---|
| Application | React + TypeScript + Vite SPA |
| Source path | `frontend/` |
| Hosting | Firebase Hosting |
| Public frontend URL | Firebase Hosting URL or custom frontend domain |
| Backend REST entry | GCP API edge under `/api/**` |
| Realtime entry | `wss://api.aquashield.example.com/ws` or deployed API domain |
| State model | Existing React/Zustand/context state, adapted to microservice APIs |
| UI strategy | Preserve current dashboard workflows while replacing integration boundaries |

## Source Control Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Commit frontend source under `frontend/` | React app tracked in the monorepo |
| [ ] | Exclude local dependencies | `frontend/node_modules/` ignored |
| [ ] | Exclude local build output | `frontend/dist/` ignored |
| [ ] | Exclude generated static exports/test reports | `frontend/html/`, `frontend/playwright-report/`, `frontend/test-results/` ignored |
| [ ] | Exclude local secrets/env files | `.env`, `.env.local`, `*.local` ignored |
| [ ] | Add safe environment example if needed | Non-secret config template |

## Environment Checklist

| Status | Variable | Purpose |
|---|---|---|
| [ ] | `VITE_API_BASE_URL` | REST API base URL through the API edge |
| [ ] | `VITE_WS_BASE_URL` | Public realtime gateway base URL |
| [ ] | `VITE_FIREBASE_*` | Firebase app config only if runtime Firebase SDK is used |
| [ ] | Local dev env | Calls local gateway/service stubs or Vite proxy |
| [ ] | Staging env | Calls deployed staging API and WSS endpoint |
| [ ] | Production/demo env | Calls deployed demo API and WSS endpoint |

## API Integration Checklist

| Status | Area | Frontend Work | Backend Owner |
|---|---|---|---|
| [ ] | Auth session | Align login, refresh, logout, and `me` calls with Identity Service contracts | Identity and Access Service |
| [ ] | User management | Preserve current user onboarding/profile/access workflows | Identity and Access Service |
| [ ] | Project/profile config | Move project summary, profile types, feature flags, and project settings calls to project contracts | Project Service |
| [ ] | Pond and cycle data | Move pond list, treatment, cycle, and pond detail calls to pond contracts | Pond Service |
| [ ] | Sensor/device setup | Add or adapt UI calls for devices, sensors, ports, and mappings when screens require them | Sensor Service |
| [ ] | Historical charts | Route chart metadata and historical chart package calls to analytics contracts | Analytics Service |
| [ ] | Pond comparison | Keep current comparison workflow and connect it to analytics contracts | Analytics Service |
| [ ] | Energy dashboard | Keep current energy dashboard workflow and connect it to analytics contracts | Analytics Service |
| [ ] | Alerts | Route alert list and acknowledge actions to notification contracts | Notification Service |
| [ ] | Audit views | Add admin audit query UI only if required for demo evidence | Audit Service |

## Platform Admin UI Checklist

| Status | Area | Frontend Work | Backend Owner |
|---|---|---|---|
| [ ] | Django Admin replacement | Identify CRUD operations currently performed through Django Admin and move required platform-admin workflows into React pages | All owning services |
| [ ] | Admin navigation | Add platform-admin navigation entries only for authorized users | Identity and Access Service |
| [ ] | User and access administration | Manage users, roles/profile assignment, project access, feature access, and action controls | Identity and Access Service |
| [ ] | Project administration | Create/update projects, assign profile type, manage project-level settings, and view project status | Project Service |
| [ ] | Profile/config administration | Manage profile types, parameter catalogues, growth/stage templates, and chart-relevant config when required | Project Service |
| [ ] | Pond administration | Create/update ponds, operational status, pond metadata, photos/URLs, and pond-project assignment | Pond Service |
| [ ] | Cycle and treatment administration | Manage cycles, treatment catalogue, and pond treatment assignments | Pond Service |
| [ ] | Sensor administration | Manage sensor types, devices, device status, ports, and project sensor mappings | Sensor Service |
| [ ] | Ingestion administration | View ingestion status, rejected telemetry, device mapping errors, and DLQ/replay evidence if exposed | Ingestion Service |
| [ ] | Notification administration | Manage alert acknowledgement/history and future threshold/rule screens if exposed | Notification Service |
| [ ] | Audit administration | Provide read-only audit search/filter/export views for assessor evidence if implemented | Audit Service |

## Authentication Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Read Identity Service REST contract before changing auth code | Frontend auth shape matches implemented backend |
| [ ] | Decide browser token handling from implemented contract | Access token/cookie behavior is explicit |
| [ ] | Keep refresh flow centralized in `api.service.ts` or auth client | No duplicated refresh logic |
| [ ] | Clear frontend state and realtime connections on logout | No stale project/session state |
| [ ] | Read feature access from session/bootstrap response | UI can hide or disable unauthorized controls |
| [ ] | Preserve server-side enforcement | UI gating is convenience only, not security authority |

## WebSocket Migration Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Replace per-pond Django WebSocket URLs | Frontend connects to the Realtime Gateway `/ws` route |
| [ ] | Add authenticated `/ws/token` request | Browser obtains short-lived realtime token |
| [ ] | Send first-frame `AUTH` after socket open | Gateway authenticates the realtime session |
| [ ] | Use WSS in deployed environments | Public browser traffic uses `wss://` |
| [ ] | Allow `ws://localhost` only for local development | Local dev remains simple without weakening deployment |
| [ ] | Add explicit subscribe/unsubscribe messages | Project/pond channels are controlled by the gateway |
| [ ] | Handle reading events | Digital twin and overview update without refresh |
| [ ] | Handle alert events | Alert banner/toasts update without refresh |
| [ ] | Handle project/settings events | Dashboard refreshes stale settings when needed |
| [ ] | Add reconnect with bounded backoff | Temporary disconnects recover safely |
| [ ] | Refresh expired realtime token before reconnecting | Long-lived sessions remain usable |
| [ ] | Deduplicate repeated event IDs if provided | Reconnect/fanout duplicates do not corrupt UI state |
| [ ] | Close all sockets on logout or project switch | No unauthorized stale subscriptions |

## Frontend State Checklist

| Status | Task | Output |
|---|---|---|
| [ ] | Keep project selection as frontend UI state | Selected project survives normal navigation |
| [ ] | Keep profile/theme selection behavior | Current profile-aware UI remains intact |
| [ ] | Add DTO adapters where backend names differ | API snake_case/camelCase differences are isolated |
| [ ] | Avoid spreading backend DTO shapes across components | Components consume frontend view models |
| [ ] | Keep live readings and historical records separate | Realtime state does not overwrite historical chart datasets |
| [ ] | Keep chart metadata/config separate from business records | Chart rendering config can be cached independently if needed |

## Testing Checklist

| Status | Test | Output |
|---|---|---|
| [ ] | `npm run lint` | Static frontend checks |
| [ ] | `npm run build` | Production build succeeds |
| [ ] | Unit tests for API adapters | Route and DTO mapping proof |
| [ ] | Unit tests for auth client | Login, refresh, logout, 401 handling |
| [ ] | Unit tests for realtime client | Auth frame, subscribe, reconnect, close behavior |
| [ ] | Playwright login smoke test | Login page and session bootstrap work |
| [ ] | Playwright overview smoke test | Project summary and pond cards render |
| [ ] | Playwright digital twin smoke test | Live readings can update the UI |
| [ ] | Playwright historical charts smoke test | Historical chart package renders |
| [ ] | Playwright user management smoke test | Admin user workflows remain functional |

## Evidence Checklist

| Status | Evidence | Expected Result |
|---|---|---|
| [ ] | Frontend commit | Source tracked without generated artifacts |
| [ ] | Build log | React production build succeeds |
| [ ] | Firebase deployment screenshot | SPA hosted successfully |
| [ ] | API network trace | Browser calls the GCP API edge |
| [ ] | WSS network trace | Browser connects to Realtime Gateway with WSS |
| [ ] | Realtime demo screenshot/video | Digital twin or alerts update without refresh |
| [ ] | CORS/origin rejection evidence | Unknown frontend origin blocked |

## Considerations

| Topic | Guidance |
|---|---|
| Monolith parity | Before changing a frontend workflow, read the current React call site and the current Django module behavior. Preserve the same business outcome unless the service contract intentionally changes it. |
| UI scope | Do not redesign the whole UI during integration. Keep the existing pages and workflows stable while replacing API and realtime boundaries. |
| API contract source | Do not invent frontend endpoints. Use the implemented service REST contracts and `api_contract_docs.md`. |
| WebSocket contract source | Use `websocket.md` and the implemented Realtime Gateway contract for token, auth-frame, event, subscribe, and heartbeat shapes. |
| Django Admin dependency | The cloud-native version should not depend on Django Admin for normal demo/admin workflows. Required platform-admin CRUD must be available from React UI pages backed by microservice APIs. |
| Admin permissions | Platform-admin UI pages must use the same Identity feature/action access model as backend services. Hide unavailable controls in the UI and still rely on backend authorization for enforcement. |
| Admin data safety | Sensitive values such as device keys, service credentials, and certificate material must not be listed casually in React tables. Show one-time generated secrets only when the backend contract intentionally supports that flow. |
| Auth security | Frontend feature gating is only UX. Backend services remain responsible for JWT validation, Redis authorization snapshot checks, and resource authorization. |
| Realtime security | Public deployments must use WSS. Plain WS is acceptable only for local development. |
| Data correctness | Cache chart metadata/config only when useful. Do not cache live telemetry or sensitive authorization data in a way that can show stale or unauthorized business records. |
| Migration style | Keep an adapter layer so pages can move service by service without rewriting every component at once. |
| Secrets | Do not commit Firebase service account keys, backend credentials, `.env`, generated reports, build output, or dependency folders. |
