# Global Alert Center

## Source Feature

The updated frontend adds a global alert source of truth mounted at the app shell level.
Active water and energy alerts are fetched once and refreshed from project WebSocket
push signals, tab focus, and explicit resolve actions.

## Source Files

- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/context/AlertsContext.tsx`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/components/alerts/AlertCenter.tsx`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/components/alerts/AlertBanner.tsx`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/App.tsx`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/frontend/src/components/layout/AppShell.tsx`

## Target Ownership

- `notification-service`: authoritative active alert list and acknowledge behavior.
- `realtime-gateway`: project-level alert/change frames.
- `frontend`: `AlertsProvider`, `AlertCenter`, shell integration.

## Current Target Gap

The microservice target has first-round alert toasts/components, but no updated
`AlertsContext` or alert center folder. The target realtime gateway already has a richer
single `/ws` token-auth model than the monolith; source WebSocket code should not be copied
directly.

## Microservice Translation Notes

- Use the microservice realtime contract: `/ws/token`, single `/ws`, first-frame `AUTH`.
- Treat WebSocket alert frames as invalidation signals; REST remains the source of truth.
- Keep alert acknowledgement in `notification-service`.
- Make sure project-level alerts with `pondId = null` render correctly.

## Sync Plan

1. Confirm `realtime-gateway` emits project-level alert frames for created/resolved alerts.
2. Port `AlertsContext`, `AlertCenter`, and `AlertBanner` with microservice API conventions.
3. Mount provider in `App.tsx` and center in `AppShell`.
4. Add tests for critical ordering, resolve state, refetch-on-frame, and project-level alerts.

## Status

In progress: first frontend/realtime slice synced on 2026-08-06.

Confirmed source behavior:

- `AlertsProvider` is the single active-alert source of truth for the frontend.
- Active alerts are loaded through `apiService.getAlerts(projectId)`.
- Project WebSocket frames are invalidation signals only; REST remains
  authoritative.
- Active alerts are refetched on mount, on alert websocket frames, and on tab
  focus.
- Resolve calls the existing acknowledge endpoint, shows a short resolved state,
  then refetches.
- `AlertCenter` is mounted once in `AppShell` and orders critical alerts before
  warning/info alerts.
- Project-level alerts (`pondId = null`) render without pond name prefixes.
- Overview no longer renders its own banners; its active-alert count comes from
  the global alert context.

Implemented target changes:

- Added `frontend/src/context/AlertsContext.tsx`.
- Added `frontend/src/components/alerts/AlertCenter.tsx`.
- Added `frontend/src/components/alerts/AlertBanner.tsx`.
- Mounted `AlertCenter` in `frontend/src/components/layout/AppShell.tsx`.
- Wrapped the routed app in `AlertsProvider` in `frontend/src/App.tsx`.
- Updated `OverviewPage` to stop fetching/rendering page-level alerts and use
  the global alert count for `SummaryCards`.
- Simplified `useGlobalWebSocket` back to pond live-reading ownership only.
- Updated `websocket.service.ts` to support multiple project subscribers per
  project, so `AlertsProvider` does not overwrite other realtime consumers.
- Updated `realtime-gateway` alert frames to emit `pond_id: null` for
  project-level alerts instead of an empty string.

Verification:

- Passed: `npm run build`
- Passed: `npm test -- --run src/test/components/AlertCenter.test.tsx src/test/services/websocket.service.test.ts src/test/services/api.service.test.ts src/test/components/Sidebar.test.tsx`
- Passed: `mvn -pl realtime-gateway,notification-service -am -DskipTests compile`
- Passed: `git diff --check`
