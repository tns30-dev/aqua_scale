/**
 * PARITY PORT of the monolith chart engine
 * (backend/module_chart/services/chart_service.py — ChartService).
 *
 * Every behavioral quirk below is deliberate monolith parity, verified against the
 * source (file:line cited in docs/evidence/analytics-service/):
 *  - three top-level shapes: enabled-keys-only (normal) vs ALL 8 keys (no readings,
 *    or any builder threw) vs all-8-with-fallback-params (config query failed)
 *  - per-bucket key omission when a parameter has zero non-null samples
 *  - hourly labels carry the RAW minutes of the LAST reading seen in the bucket
 *  - correlation pairs positionally (index truncation), NOT by timestamp
 *  - diseaseRisk / waterQualityIndex are hard [] — no formula exists in the monolith
 */

import { mean, pearson, pyTitle, round2 } from './python';

export interface Reading {
  /** measured_at */
  timestamp: Date;
  /** parameter_code -> numeric value (nulls already excluded upstream) */
  values: Record<string, number>;
}

export interface ChartConfigEntry {
  projectVisualisationId: string;
  /** EXACT visualisation_types.name dispatch key */
  visualisationName: string;
  yParameterCodes: string[];
}

export type Grouping = 'hourly' | 'daily' | 'weekly' | 'monthly' | string;

/** chart_service.py:277-286 — fallback when the per-chart config lookup fails. */
const FALLBACK_PARAMS = [
  'temperature', 'ph', 'dissolved_oxygen', 'turbidity', 'ammonia', 'salinity',
];

/** chart_service.py:334 — the heatmap's fixed parameter universe. */
const HEATMAP_PARAMS = ['temperature', 'ph', 'dissolved_oxygen', 'turbidity'];

/** chart_service.py:400 — nitrogen cycle's fixed parameter set. */
const NITROGEN_PARAMS = ['ammonia', 'nitrite', 'nitrate', 'ammonium', 'tan'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * PARITY CORRECTION: the monolith's ACTIVE settings are config/settings/base.py with
 * TIME_ZONE='Asia/Singapore' (+08:00, no DST) — the config/settings.py 'UTC' file is
 * shadowed dead code. All bucketing/labels run in local (+08) time.
 */
export const DEFAULT_TZ_OFFSET_MINUTES = 480;
let tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES;

export function setTimezoneOffsetMinutes(minutes: number): void {
  tzOffsetMinutes = minutes;
}

export function timezoneOffsetMinutes(): number {
  return tzOffsetMinutes;
}

/** ±HH:MM suffix for ISO timestamps in the active zone. */
export function timezoneSuffix(): string {
  const sign = tzOffsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(tzOffsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/** chart_service.py:200-214 — auto grouping from integer day span (may be negative). */
export function groupingStrategy(days: number): Grouping {
  if (days <= 3) {
    return 'hourly';
  }
  if (days <= 90) {
    return 'daily';
  }
  return 'weekly';
}

export function resolveGrouping(grouping: string | undefined, days: number): Grouping {
  return grouping === 'auto' || !grouping ? groupingStrategy(days) : grouping;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * chart_service.py:216-239 (_get_period_key_and_label) in LOCAL time (Asia/Singapore;
 * fixed offset — no DST — so shift-then-UTC-getters is exact).
 * Unknown grouping values fall through to monthly — parity with the else branch.
 */
export function periodKeyLabel(ts: Date, grouping: Grouping): [string, string] {
  const local = new Date(ts.getTime() + tzOffsetMinutes * 60_000);
  const y = local.getUTCFullYear();
  const mon = MONTHS[local.getUTCMonth()];
  const m = pad2(local.getUTCMonth() + 1);
  const d = pad2(local.getUTCDate());
  const h = pad2(local.getUTCHours());
  if (grouping === 'hourly') {
    // label keeps the reading's RAW minutes (strftime %H:%M on the timestamp)
    return [`${y}-${m}-${d} ${h}:00`, `${mon} ${d} ${h}:${pad2(local.getUTCMinutes())}`];
  }
  if (grouping === 'daily') {
    return [`${y}-${m}-${d}`, `${mon} ${d}`];
  }
  if (grouping === 'weekly') {
    // Monday of the ISO week: timestamp - weekday() days (Python weekday: Mon=0)
    const weekday = (local.getUTCDay() + 6) % 7;
    const ws = new Date(Date.UTC(y, local.getUTCMonth(), local.getUTCDate() - weekday));
    const wmon = MONTHS[ws.getUTCMonth()];
    const wd = pad2(ws.getUTCDate());
    return [`${ws.getUTCFullYear()}-${pad2(ws.getUTCMonth() + 1)}-${wd}`, `${wmon} ${wd}`];
  }
  // monthly + any unknown grouping string
  return [`${y}-${m}`, `${mon} ${y}`];
}

export type TrendEntry = { date: string; label: string } & Record<string, unknown>;

/**
 * The shared bucketing loop (chart_service.py:292-323 / 387-419): group by period key,
 * collect non-null values per parameter, average + round per bucket; a parameter key
 * is OMITTED from a bucket entry when it had no samples; label = last reading's label.
 */
function buildGroupedTrends(readings: Reading[], params: string[], grouping: Grouping): TrendEntry[] {
  const byPeriod = new Map<string, Map<string, number[]>>();
  const labels = new Map<string, string>();
  for (const reading of readings) {
    const [key, label] = periodKeyLabel(reading.timestamp, grouping);
    labels.set(key, label); // last write wins — parity with period_labels[key] = label
    for (const param of params) {
      const value = reading.values[param];
      if (value !== undefined && value !== null) {
        let bucket = byPeriod.get(key);
        if (!bucket) {
          bucket = new Map<string, number[]>();
          byPeriod.set(key, bucket);
        }
        let series = bucket.get(param);
        if (!series) {
          series = [];
          bucket.set(param, series);
        }
        series.push(value);
      }
    }
  }
  const result: TrendEntry[] = [];
  for (const key of [...byPeriod.keys()].sort()) {
    const entry: TrendEntry = { date: key, label: labels.get(key) ?? key };
    for (const [param, values] of byPeriod.get(key)!) {
      if (values.length > 0) {
        entry[param] = round2(mean(values));
      }
    }
    result.push(entry);
  }
  return result;
}

/**
 * chart_service.py:245-323. paramCodes=null means the config lookup failed
 * (DoesNotExist / exception) -> fallback defaults. An EMPTY array is parity-distinct:
 * configured-but-empty y_parameters -> [] (chart_service.py:288-289).
 */
export function buildMultiParameterTrends(
  readings: Reading[], paramCodes: string[] | null, grouping: Grouping): TrendEntry[] {
  const params = paramCodes === null ? FALLBACK_PARAMS : paramCodes;
  if (params.length === 0 || readings.length === 0) {
    return [];
  }
  return buildGroupedTrends(readings, params, grouping);
}

export interface CorrelationHeatmap {
  parameters: string[];
  parameterLabels: Record<string, string>;
  matrix: number[][];
}

/** chart_service.py:325-367 — grouping-independent, raw values, positional pairing. */
export function buildCorrelationHeatmap(readings: Reading[]): CorrelationHeatmap {
  const byParam = new Map<string, number[]>();
  for (const reading of readings) {
    for (const param of HEATMAP_PARAMS) {
      const value = reading.values[param];
      if (value !== undefined && value !== null) {
        let series = byParam.get(param);
        if (!series) {
          series = [];
          byParam.set(param, series);
        }
        series.push(value);
      }
    }
  }
  const parameters = [...byParam.keys()].filter((p) => byParam.get(p)!.length > 1).sort();
  if (parameters.length < 2) {
    return { parameters: [], parameterLabels: {}, matrix: [] };
  }
  const n = parameters.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0.0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0;
      } else {
        // PARITY: truncate both series to min length and pair by INDEX, not time
        const xs = byParam.get(parameters[i])!;
        const ys = byParam.get(parameters[j])!;
        const minLen = Math.min(xs.length, ys.length);
        if (minLen > 1) {
          try {
            matrix[i][j] = round2(pearson(xs.slice(0, minLen), ys.slice(0, minLen)));
          } catch {
            matrix[i][j] = 0.0; // zero variance -> StatisticsError -> 0.0
          }
        }
      }
    }
  }
  const parameterLabels: Record<string, string> = {};
  for (const p of parameters) {
    parameterLabels[p] = pyTitle(p.replace(/_/g, ' '));
  }
  return { parameters, parameterLabels, matrix };
}

/** chart_service.py:381-419 — fixed nitrogen parameter set, same bucketing engine. */
export function buildNitrogenCycle(readings: Reading[], grouping: Grouping): TrendEntry[] {
  return buildGroupedTrends(readings, NITROGEN_PARAMS, grouping);
}

/**
 * chart_service.py:421-457 — single parameter; buckets with no samples are dropped.
 * PARITY: the monolith skips null readings BEFORE recording the bucket label, so a
 * later null reading in the same hourly bucket cannot steal the label's minutes.
 */
export function buildSingleParameterTrend(
  readings: Reading[], parameter: string, grouping: Grouping): TrendEntry[] {
  const withValue = readings.filter(
    (reading) => reading.values[parameter] !== undefined && reading.values[parameter] !== null);
  return buildGroupedTrends(withValue, [parameter], grouping);
}

/** chart_service.py:469-481 — emitted on no-readings AND on any builder exception. */
export function emptyChartPackage(): Record<string, unknown> {
  return {
    multiParameterTrends: [],
    correlationHeatmap: { parameters: [], parameterLabels: {}, matrix: [] },
    historicalTrends: [],
    nitrogenCycle: [],
    temperatureTrend: [],
    dissolvedOxygen: [],
    diseaseRisk: [],
    waterQualityIndex: [],
  };
}

/**
 * chart_service.py:32-169 (get_historical_chart_data) once readings + config are in
 * hand. `config === null` replicates the monolith's config-query-failure path: ALL
 * charts included, multi/historical fall back to default parameters.
 */
export function buildHistoricalChartPackage(
  readings: Reading[],
  config: ChartConfigEntry[] | null,
  grouping: Grouping,
): Record<string, unknown> {
  if (readings.length === 0) {
    return emptyChartPackage();
  }
  const byName = config === null
    ? null
    : new Map(config.map((c) => [c.visualisationName, c]));
  const shouldInclude = (name: string): boolean => byName === null || byName.has(name);
  const yParams = (name: string): string[] | null =>
    byName === null ? null : byName.get(name)?.yParameterCodes ?? null;

  const result: Record<string, unknown> = {};
  try {
    if (shouldInclude('Multi-Parameter Trends')) {
      result.multiParameterTrends =
          buildMultiParameterTrends(readings, yParams('Multi-Parameter Trends'), grouping);
    }
    if (shouldInclude('Parameter Correlation Heatmap')) {
      result.correlationHeatmap = buildCorrelationHeatmap(readings);
    }
    if (shouldInclude('Historical Trends of Key Parameters')) {
      // PARITY: same builder as multi, but driven by its OWN config row's y_parameters
      result.historicalTrends = buildMultiParameterTrends(
        readings, yParams('Historical Trends of Key Parameters'), grouping);
    }
    if (shouldInclude('Nitrogen Cycle Monitoring')) {
      result.nitrogenCycle = buildNitrogenCycle(readings, grouping);
    }
    if (shouldInclude('Temperature Trend Analysis')) {
      result.temperatureTrend = buildSingleParameterTrend(readings, 'temperature', grouping);
    }
    if (shouldInclude('Dissolved Oxygen Monitoring')) {
      result.dissolvedOxygen = buildSingleParameterTrend(readings, 'dissolved_oxygen', grouping);
    }
    if (shouldInclude('Disease Risk Assessment')) {
      result.diseaseRisk = []; // monolith stub — NO formula exists; [] is the contract
    }
    if (shouldInclude('Water Quality Index')) {
      result.waterQualityIndex = []; // monolith stub — parity
    }
    return result;
  } catch {
    return emptyChartPackage(); // any builder error -> full empty package (parity)
  }
}
