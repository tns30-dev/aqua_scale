# [XSVC] Readings Wired — Pond Comparison + Energy Dashboard (+ TZ correction)

Ship date: 2026-06-04. The long-flagged cross-service dependency is CLOSED: every
reading-derived value that shipped as a zero-stub is now computed from real telemetry
through `IngestionReadService` gRPC.

## CRITICAL parity correction discovered en route: TIME_ZONE

The monolith's ACTIVE settings are the `config/settings/` PACKAGE (`__init__.py` →
`development.py` → `base.py`), which sets **`TIME_ZONE='Asia/Singapore'`** (+08:00).
The flat `config/settings.py` with `TIME_ZONE='UTC'` is shadowed dead code — and was the
file the earlier chart-parity extraction read. Consequences fixed in this ship:
- **analytics-service** chart engine bucketing/labels moved from UTC to a configurable
  fixed offset (`TZ_OFFSET_MINUTES`, default 480) and the readings window is now
  `[start 00:00:00+08:00, end 23:59:59.999999+08:00]`. All 49 vitest oracles re-anchored
  to +08 inputs (expectations unchanged — inputs shifted).
- pond comparison + energy dashboard implemented +08-correct from the start
  (`aquashield.timezone`, default `Asia/Singapore`).

## Seam extensions (ingestion.proto)

- `GetReadingsRequest.project_id` — alternative selector (energy is project-scoped:
  monolith filters `sensor_readings` by `project_id`, NOT pond). `ReadingRow.pond_id`
  added for attribution. No selector → INVALID_ARGUMENT.
- NEW `GetReadingWindows(pond_ids) -> {pond_id, first_at, last_at}` — batched min/max
  per pond (the monolith's `Min/Max(measured_at)` aggregate for comparison options:
  `hasSensorData` / `firstReadingAt` / `lastReadingAt`).
- Fix: nested JPA entity needed an explicit JPQL name (`@Entity(name="SensorReadingRow")`)
  for the min/max @Query.

## New shared helper: common `PyRound`

CPython `round()` parity (half-to-even on the EXACT binary double via
`new BigDecimal(double)` — `BigDecimal.valueOf` or `Math.round` would both diverge:
`round(2.675, 2) == 2.67`, `round(2.5) == 2`). Used by pond comparison, energy dashboard,
and pre-applied before Java's half-up `%f` formatting (Python's `format()` also rounds
half-even). Unit-tested against CPython output.

## (A) Pond comparison (pond-service) — parity: module_pond/services/pond_comparison.py

- Readings per pond via GetReadings (4-param filter), window = local day bounds.
- Metric cards: `_safe_avg` over the WHOLE range (None dropped, 2dp), `difference`
  (2dp), `percentDifference` (`_pct_diff`: banker's int, 0 when denominator 0).
- Charts: shared bucket grid keyed by bucket-start local datetime; per-bucket `_safe_avg`;
  empty buckets 0.0. GRID FIX vs the stub era: multi-day hourly enumerates EVERY hour of
  the span (monolith cursor runs to `end_date 23:59:59.999999`) — the old port emitted
  only the first day's 24.
- Options: `hasSensorData`/`firstReadingAt`/`lastReadingAt` from GetReadingWindows;
  timestamps in Python `isoformat()` shape localized to +08 (`2026-06-03T14:00:00+08:00`).
- Fail-soft: readings errors → empty (monolith `get_readings` catch-all) — never 5xx.
- Worked oracle (CPython-verified): pondA `[ammonium .10/.20, do 5/6, turb 12/None,
  elec 1.5/2.5]` vs pondB `[.40, 4, 10, 3]` → ammonium `0.15/0.4/-0.25/-62`,
  do `5.5/4.0/1.5/38` (37.5→even), turbidity `12.0` (None dropped), elec `2.0/-33`;
  hourly bucket `Jun 03 14:00` (06:00Z+08); 24-bucket grid; zero-filled elsewhere.

## (B) Energy dashboard (project-service) — parity: module_project/services/energy_dashboard.py

Full line-cited port replacing the zero-data stub — WHICH HAD DRIFTED KEYS (the stub's
`tariffPerUnit`/`avgDailyKwh`/string `compareInfo` did not match the monolith's
`tariffPerKwh`/`avgKwhPerDay`/`avgKwhPerHour`/object `compareInfo`; now exact):
- `_hourly`: project-wide electricity rows (GetReadings project selector,
  `electricity` filter = `electricity__isnull=False`), SUMMED per local hour
  (per-interval consumption — never diffed); sparse dict.
- kpis: totals 3dp, cost 2dp, tariff 4dp, avgs 2dp (banker's: `3.0/24 → 0.12`),
  `_peak` first-max insertion order (`'—'`/0.0 when empty), `changeVsPreviousPct` 1dp
  (0.0 when no previous), `compareLabel` pluralization.
- trend: `_series` (chronological hours → first-seen buckets, 3dp) zipped with the
  previous period BY INDEX; labels from current. byPeriod: same series + title map.
- heatmap: 24×N-days matrix, cells null until data, 3dp, maxValue.
- summary: 4 rows with `{:,.2f}` formats (`$0.75`, `3.00 kWh`), change strings
  (`200.0% higher` / `no prior data` / `—`), `improved` flag.
- alerts: hourly then daily, sorted, strict `>`, `{:,.1f}`, capped at 20.
- dataQuality: distinct populated hours vs `days*24`, 1dp percentages, `lastReceived`.
- compareInfo: `{currentRange, previousRange}` via `_range_label` (en-dash, year rules).
- Previous period: equal length immediately before start (`prev_end = start-1d`).
- Worked oracle (CPython-verified): cur hours `{14:00→2.5, 16:00→0.5}` prev `{1.0}`,
  tariff 0.25 USD, hourly thr 2.0 → totalKwh 3.0, cost 0.75, avgKwhPerHour 0.12,
  peak `14:00`/2.5, change 200.0, 1 alert `"Jun 03, 14:00" / "2.5 kWh"`, completeness
  8.3/91.7, lastReceived `"Jun 03, 16:00"`, summary `"3.00 kWh"/"1.00 kWh"/"200.0%
  higher"`, cost row `"$0.75"/"$0.25"`.

## Test evidence

- ingestion: **10/10** (t08b extended: project selector, pond_id on rows, no-selector
  INVALID_ARGUMENT, GetReadingWindows min/max + unknown-pond absence)
- pond-service: **17/17** (PondApiIT 7 incl. NEW t05b real-readings oracle;
  ComparisonMathTest 5 incl. multi-day-hourly grid + banker's; CycleLogicTest 5)
- project-service: **11/11 ITs** (incl. NEW t08b full energy oracle) + 8 unit
- common: +2 PyRound CPython oracles
- analytics: **49/49** vitest under +08 semantics
- Full reactor `mvn clean verify`: green (see counts in tracker)

## Known deltas (documented, accepted)

- `_peak`/dict-iteration tie-breaks: monolith order = unsorted DB row order; ours =
  measured_at ASC from the seam. First-max-wins semantics preserved; exact tie-break on
  equal maxima may differ when DB returned rows unordered. Practically unobservable.
- Energy fake in ITs window-filters server-side like the real seam (two-period queries).
