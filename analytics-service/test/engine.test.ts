/**
 * Oracle tests — cases derived from the monolith chart engine
 * (backend/module_chart/services/chart_service.py) by the parity extraction.
 * Setup A: pond readings on 2026-03-17/18 (see docs/evidence/analytics-service/).
 */
import { describe, expect, it } from 'vitest';
import {
  buildCorrelationHeatmap,
  buildHistoricalChartPackage,
  buildMultiParameterTrends,
  buildNitrogenCycle,
  buildSingleParameterTrend,
  emptyChartPackage,
  groupingStrategy,
  periodKeyLabel,
  Reading,
  resolveGrouping,
} from '../src/charts/engine';

function r(iso: string, values: Record<string, number>): Reading {
  return { timestamp: new Date(iso), values };
}

// Setup A from the parity spec
const SETUP_A: Reading[] = [
  r('2026-03-17T08:00:00Z', { temperature: 28.0, ph: 7.8, dissolved_oxygen: 6.2, turbidity: 4.0 }),
  r('2026-03-17T20:00:00Z', { temperature: 29.0, ph: 7.9, dissolved_oxygen: 6.0, turbidity: 4.4 }),
  r('2026-03-18T08:00:00Z', { temperature: 27.0, ph: 8.0, turbidity: 3.6 }), // do = null
];

const Y_PARAMS = ['temperature', 'ph', 'dissolved_oxygen'];

describe('grouping resolution (chart_service.py:200-214)', () => {
  it('auto: <=3 days hourly, 4-90 daily, 91+ weekly', () => {
    expect(groupingStrategy(0)).toBe('hourly');
    expect(groupingStrategy(3)).toBe('hourly');
    expect(groupingStrategy(4)).toBe('daily');
    expect(groupingStrategy(90)).toBe('daily');
    expect(groupingStrategy(91)).toBe('weekly');
  });

  it('negative day span (endDate < startDate) resolves hourly — no 400 in monolith', () => {
    expect(groupingStrategy(-5)).toBe('hourly');
  });

  it('explicit grouping passes through verbatim; unknown strings act as monthly', () => {
    expect(resolveGrouping('weekly', 0)).toBe('weekly');
    expect(resolveGrouping('auto', 10)).toBe('daily');
    expect(resolveGrouping(undefined, 10)).toBe('daily');
    expect(periodKeyLabel(new Date('2026-03-17T08:15:00Z'), 'bogus')[0]).toBe('2026-03');
  });
});

describe('period keys and labels (chart_service.py:216-239, UTC)', () => {
  const ts = new Date('2026-03-17T08:15:00Z');

  it('hourly key zeroes minutes; label keeps RAW minutes (%H:%M)', () => {
    expect(periodKeyLabel(ts, 'hourly')).toEqual(['2026-03-17 08:00', 'Mar 17 08:15']);
  });

  it('daily / monthly formats', () => {
    expect(periodKeyLabel(ts, 'daily')).toEqual(['2026-03-17', 'Mar 17']);
    expect(periodKeyLabel(ts, 'monthly')).toEqual(['2026-03', 'Mar 2026']);
  });

  it('weekly buckets to the Monday of the week (oracle 14)', () => {
    // Tue 2026-03-17 and Thu 2026-03-19 -> Monday 2026-03-16
    expect(periodKeyLabel(new Date('2026-03-17T08:00:00Z'), 'weekly'))
      .toEqual(['2026-03-16', 'Mar 16']);
    expect(periodKeyLabel(new Date('2026-03-19T23:00:00Z'), 'weekly'))
      .toEqual(['2026-03-16', 'Mar 16']);
  });
});

describe('multiParameterTrends (oracles 1, 5)', () => {
  it('daily: averages per bucket, omits params with zero samples (oracle 1)', () => {
    expect(buildMultiParameterTrends(SETUP_A, Y_PARAMS, 'daily')).toEqual([
      { date: '2026-03-17', label: 'Mar 17', temperature: 28.5, ph: 7.85, dissolved_oxygen: 6.1 },
      { date: '2026-03-18', label: 'Mar 18', temperature: 27.0, ph: 8.0 },
    ]);
  });

  it('hourly: one bucket per hour (oracle 5)', () => {
    expect(buildMultiParameterTrends(SETUP_A, Y_PARAMS, 'hourly')).toEqual([
      { date: '2026-03-17 08:00', label: 'Mar 17 08:00', temperature: 28.0, ph: 7.8, dissolved_oxygen: 6.2 },
      { date: '2026-03-17 20:00', label: 'Mar 17 20:00', temperature: 29.0, ph: 7.9, dissolved_oxygen: 6.0 },
      { date: '2026-03-18 08:00', label: 'Mar 18 08:00', temperature: 27.0, ph: 8.0 },
    ]);
  });

  it('null config (lookup failed) -> fallback defaults; empty config -> [] (parity edge)', () => {
    const fallback = buildMultiParameterTrends(SETUP_A, null, 'daily');
    expect(fallback[0]).toHaveProperty('turbidity', 4.2); // fallback set includes turbidity
    expect(buildMultiParameterTrends(SETUP_A, [], 'daily')).toEqual([]);
  });
});

describe('singleParameterTrend (oracles 3, 4)', () => {
  it('temperatureTrend daily', () => {
    expect(buildSingleParameterTrend(SETUP_A, 'temperature', 'daily')).toEqual([
      { date: '2026-03-17', label: 'Mar 17', temperature: 28.5 },
      { date: '2026-03-18', label: 'Mar 18', temperature: 27.0 },
    ]);
  });

  it('dissolvedOxygen daily: empty bucket is DROPPED, not emitted (oracle 4)', () => {
    expect(buildSingleParameterTrend(SETUP_A, 'dissolved_oxygen', 'daily')).toEqual([
      { date: '2026-03-17', label: 'Mar 17', dissolved_oxygen: 6.1 },
    ]);
  });
});

describe('nitrogenCycle (oracle 6)', () => {
  it('fixed params; absent params omitted; phosphate NEVER appears', () => {
    const readings = [
      r('2026-03-17T08:00:00Z', { ammonia: 0.5, phosphate: 1.0 }),
      r('2026-03-17T12:00:00Z', { ammonia: 0.7, nitrate: 10 }),
    ];
    expect(buildNitrogenCycle(readings, 'daily')).toEqual([
      { date: '2026-03-17', label: 'Mar 17', ammonia: 0.6, nitrate: 10.0 },
    ]);
  });
});

describe('correlationHeatmap (oracle 9)', () => {
  it('fixed 4-param universe, alphabetical, diagonal 1.0, worked pearson -0.5', () => {
    const heatmap = buildCorrelationHeatmap(SETUP_A);
    expect(heatmap.parameters).toEqual(['dissolved_oxygen', 'ph', 'temperature', 'turbidity']);
    expect(heatmap.parameterLabels).toEqual({
      dissolved_oxygen: 'Dissolved Oxygen',
      ph: 'Ph',
      temperature: 'Temperature',
      turbidity: 'Turbidity',
    });
    const ti = heatmap.parameters.indexOf('temperature');
    const pi = heatmap.parameters.indexOf('ph');
    expect(heatmap.matrix[ti][ti]).toBe(1.0);
    expect(heatmap.matrix[ti][pi]).toBe(-0.5);
    expect(heatmap.matrix[pi][ti]).toBe(-0.5); // symmetric in practice
  });

  it('params with <=1 sample are excluded; <2 qualifying params -> empty shape', () => {
    const single = [r('2026-03-17T08:00:00Z', { temperature: 28.0, ph: 7.8 })];
    expect(buildCorrelationHeatmap(single))
      .toEqual({ parameters: [], parameterLabels: {}, matrix: [] });
  });

  it('constant series (zero variance) yields 0.0, not an error', () => {
    const flat = [
      r('2026-03-17T08:00:00Z', { temperature: 25.0, ph: 7.0 }),
      r('2026-03-17T09:00:00Z', { temperature: 25.0, ph: 7.5 }),
    ];
    const heatmap = buildCorrelationHeatmap(flat);
    const ti = heatmap.parameters.indexOf('temperature');
    const pi = heatmap.parameters.indexOf('ph');
    expect(heatmap.matrix[ti][pi]).toBe(0.0);
  });
});

describe('top-level package shapes (oracles 7, 8, 10, 11, 12)', () => {
  const FULL_CONFIG = [
    'Multi-Parameter Trends', 'Parameter Correlation Heatmap',
    'Historical Trends of Key Parameters', 'Nitrogen Cycle Monitoring',
    'Temperature Trend Analysis', 'Dissolved Oxygen Monitoring',
    'Disease Risk Assessment', 'Water Quality Index',
  ].map((name) => ({
    projectVisualisationId: '00000000-0000-0000-0000-000000000000',
    visualisationName: name,
    yParameterCodes: Y_PARAMS,
  }));

  it('normal path returns ONLY enabled keys (oracle 11)', () => {
    const onlyHeatmap = FULL_CONFIG.filter(
      (c) => c.visualisationName === 'Parameter Correlation Heatmap');
    const pkg = buildHistoricalChartPackage(SETUP_A, onlyHeatmap, 'daily');
    expect(Object.keys(pkg)).toEqual(['correlationHeatmap']);
  });

  it('diseaseRisk and waterQualityIndex are hard [] — monolith stubs (oracles 7, 8)', () => {
    const pkg = buildHistoricalChartPackage(SETUP_A, FULL_CONFIG, 'daily');
    expect(pkg.diseaseRisk).toEqual([]);
    expect(pkg.waterQualityIndex).toEqual([]);
  });

  it('historicalTrends uses its OWN config row, same builder as multi', () => {
    const pkg = buildHistoricalChartPackage(SETUP_A, FULL_CONFIG, 'daily') as Record<string, unknown>;
    expect(pkg.historicalTrends).toEqual(pkg.multiParameterTrends);
  });

  it('empty readings -> the FULL 8-key empty package regardless of config (oracle 10)', () => {
    const onlyHeatmap = FULL_CONFIG.slice(1, 2);
    expect(buildHistoricalChartPackage([], onlyHeatmap, 'daily')).toEqual(emptyChartPackage());
    expect(Object.keys(emptyChartPackage())).toHaveLength(8);
  });

  it('null config (config query failed) -> ALL 8 keys with fallback params (oracle 12)', () => {
    const pkg = buildHistoricalChartPackage(SETUP_A, null, 'daily') as Record<string, unknown>;
    expect(Object.keys(pkg).sort()).toEqual([
      'correlationHeatmap', 'diseaseRisk', 'dissolvedOxygen', 'historicalTrends',
      'multiParameterTrends', 'nitrogenCycle', 'temperatureTrend', 'waterQualityIndex',
    ]);
    const multi = pkg.multiParameterTrends as Array<Record<string, unknown>>;
    expect(multi[0]).toHaveProperty('turbidity'); // fallback param set in play
  });

  it('weekly grouping merges Tue+Thu into the Monday bucket (oracle 14)', () => {
    const readings = [
      r('2026-03-17T08:00:00Z', { temperature: 28.0 }),
      r('2026-03-19T08:00:00Z', { temperature: 30.0 }),
    ];
    expect(buildSingleParameterTrend(readings, 'temperature', 'weekly')).toEqual([
      { date: '2026-03-16', label: 'Mar 16', temperature: 29.0 },
    ]);
  });
});
