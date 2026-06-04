# Phase 2 - Frontend Integration

## Goal

Replace the hardcoded data in `ABTestingPage.tsx` with backend data from phase 1 while preserving the current UI behavior.

## Current Frontend Behavior To Keep

- Pond A and Pond B are editable draft selections.
- Charts and metric cards update only after the user clicks Apply.
- Stacked view overlays both ponds on each chart.
- Side-by-side view renders one column per pond.
- Profile theme and comparison colors still drive styling.

## API Service Additions

Add methods to `frontend/src/services/api.service.ts`:

```ts
getPondComparisonOptions(projectId: string): Promise<PondComparisonOptionsResponse>

getPondComparison(params: {
  projectId: string;
  pondAId: string;
  pondBId: string;
  startDate: string;
  endDate: string;
  grouping?: string;
}): Promise<PondComparisonResponse>
```

The methods should use the existing axios singleton:

- same `baseURL`
- same cookie auth
- same CSRF behavior for unsafe requests
- no raw `fetch`

These are GET requests, so no CSRF header is needed.

## Type Additions

Extend `frontend/src/types/index.ts` with backend response types:

```ts
export interface PondComparisonPondOption {
  pondId: string;
  name: string;
  companyName?: string | null;
  gpsLocation?: string | null;
  treatmentStartDate?: string | null;
  hasSensorData: boolean;
  firstReadingAt?: string | null;
  lastReadingAt?: string | null;
}

export interface PondComparisonMetric {
  parameter: string;
  label: string;
  unit: string;
  treatmentValue: number | null;
  baselineValue: number | null;
  difference: number | null;
  percentDifference: number | null;
  lowerIsBetter: boolean | null;
}

export interface PondComparisonChart {
  parameter: string;
  title: string;
  unit: string;
  variant: "line" | "bar";
  data: ComparisonChartDataPoint[];
}
```

`ABTestingPondOption` may become an alias or be replaced by `PondComparisonPondOption`.

## Page State

Recommended state groups:

- pond options loading/error
- comparison loading/error
- draft config
- applied result
- chart view mode

Avoid storing duplicated metric/chart data in multiple places.

## Initial Load

On page mount:

1. Resolve current selected project.
2. Fetch pond options.
3. Pick the first two ponds that have sensor data if possible.
4. Default date range:
   - If both ponds have reading ranges, use their overlapping range.
   - Otherwise fallback to last 30 days.
5. Optionally auto-apply once if two ponds exist.

If fewer than two ponds are available:

- Show an empty state.
- Disable Apply.
- Do not throw.

## Apply Behavior

When Apply is clicked:

1. Validate Pond A and Pond B are different on the client.
2. Validate dates are present.
3. Call comparison endpoint.
4. Set applied result only after success.
5. Show toast or inline error on failure.

Do not update chart labels/data just because draft selectors changed. That would break the existing draft/applied mental model.

## Mapping Backend To Current Components

Metric cards:

- Use `response.metrics` instead of local `metricPairs`.
- `MetricCard` currently expects `number`; it will need either:
  - null handling, or
  - the page filters out metrics with null values.

Charts:

- Use `response.charts`.
- `ComparisonChart` currently expects both `seriesA` and `seriesB` as numbers.
- For side-by-side mode, avoid the current `undefined as unknown as number` workaround long term. Better options:
  - Teach `ComparisonChart` to support one-series mode.
  - Or keep stacked-only for first integration, then clean side-by-side.

Pond details cards:

- Replace hardcoded company/GPS/treatment date with pond option metadata.

## Loading And Error States

Pond options:

- Loading: skeleton or small loading row near config.
- Error: page-level error with retry.
- Empty: "No ponds available for this project."

Comparison:

- Loading: pass `isLoading` to charts and disable Apply.
- Error: toast or inline alert near config.
- Empty data: show the existing empty chart state.

## Acceptance Criteria

- Page no longer imports or uses mock pond/chart/metric data.
- Pond dropdowns come from backend.
- Apply calls backend and updates metric cards/charts.
- Errors are visible to the user.
- Same-pond selection is prevented before API call.
- No localStorage auth token logic is introduced.
- Existing cookie auth and refresh behavior remains centralized in `api.service.ts`.
