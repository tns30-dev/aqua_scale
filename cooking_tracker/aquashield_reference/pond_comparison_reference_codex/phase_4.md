# Phase 4 - Tests And Production Hardening

## Goal

Make the feature reliable enough to port from learning repo to production repo with low ambiguity.

## Backend Tests

Recommended test file:

`backend/module_project/tests/test_pond_comparison.py`

Test cases:

- Authenticated user can list ponds for an accessible project.
- User cannot list ponds for inaccessible project.
- User without `view_pond_comparison` cannot access comparison endpoints.
- `pondAId == pondBId` returns `400`.
- Missing date params return `400`.
- Invalid date format returns `400`.
- `endDate < startDate` returns `400`.
- Pond outside project returns `404` or `403`, consistently.
- Empty reading range returns `200` with empty metrics/charts.
- Valid comparison returns metrics and charts with expected shape.

Test data:

- Prefer small fixture data over relying on the developer's local `aquaculture` database.
- Keep tests deterministic.
- Include at least two ponds under one project and readings for both.

## Frontend Tests / Checks

Minimum:

- TypeScript compile.
- Page renders with mocked API data.
- Same-pond selection disables Apply or shows error.
- API error is visible.
- Empty response shows empty state.

Useful later:

- Playwright smoke:
  - login
  - navigate to pond comparison
  - select two ponds
  - apply date range
  - verify charts/cards render

## Performance Checks

Potential issue:

- `get_readings()` loads all matching readings into Python, then aggregates.

This is acceptable for phase 1's small local/demo data.

Before production scale:

- Check expected number of rows per pond per date range.
- Add query time logging for comparison endpoint.
- Consider SQL aggregation directly in PostgreSQL if ranges become large.
- Ensure `sensor_readings(pond_id, measured_at DESC)` index exists. It does in current schema.

## Security Checks

Backend:

- Require authentication.
- Enforce project access.
- Enforce `view_pond_comparison`.
- Do not expose ponds outside the user's project list.
- Do not trust frontend-selected project or pond IDs without backend verification.

Frontend:

- Route should be protected.
- Sidebar visibility should use `hasFeature("view_pond_comparison")` eventually.
- Do not store raw sensor data or credentials in localStorage.

## Porting Checklist

When moving to production repo:

- Backend files copied.
- Frontend types copied.
- `api.service.ts` methods copied.
- `ABTestingPage.tsx` integration copied.
- Any new tests copied.
- Any fixture changes copied.
- `feature_access` includes `view_pond_comparison`.
- Production `.env`/CORS/CSRF unaffected because endpoints are same-origin GET.

## Acceptance Criteria

- Backend tests pass.
- Frontend typecheck passes.
- The feature works on hard refresh with cookie auth.
- The feature fails closed for unauthorized users.
- The page has useful loading, empty, and error states.
- The response contract is documented before porting.
