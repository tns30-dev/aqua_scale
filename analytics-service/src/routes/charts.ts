/**
 * PARITY contract: GET /api/projects/{projectId}/charts/
 * (module_project/views.py:95-143 ProjectViewSet.charts)
 *
 * Validation order is the monolith's, exactly:
 *  project scope (404) -> pondId presence (400) -> pond-in-project (404)
 *  -> date presence (400) -> date format (400) -> chart package (200).
 * Error bodies are verbatim monolith strings.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { hasProjectAccess, KV } from '../auth/auth';
import { buildHistoricalChartPackage, ChartConfigEntry, Reading, resolveGrouping, timezoneSuffix } from '../charts/engine';
import type { Backends, BucketAverage } from '../grpc/backends';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CHART_PACKAGE_TTL_MS = 30_000;
const CHART_PACKAGE_CACHE_MAX = 128;
const CHART_TIMEZONE = 'Asia/Singapore';
const CHART_AGGREGATE_PARAMETERS = [
  'temperature',
  'ph',
  'dissolved_oxygen',
  'turbidity',
  'ammonia',
  'salinity',
  'nitrite',
  'nitrate',
  'ammonium',
  'tan',
];

export interface ChartsDeps {
  backends: Backends;
  kv: KV;
  /** chart METADATA cache TTL; raw readings are not written to Redis. */
  chartConfigTtlSeconds: number;
}

/** date.fromisoformat parity for the YYYY-MM-DD calls the frontend makes. */
function parseIsoDate(value: string): Date | null {
  if (!DATE_RE.test(value)) {
    return null;
  }
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // reject out-of-range components Date.UTC would silently roll over
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

const CONFIG_CACHE_PREFIX = 'analytics:chart-config:';
type ChartPackage = ReturnType<typeof buildHistoricalChartPackage>;

interface ChartPackageCacheEntry {
  expiresAt: number;
  promise: Promise<ChartPackage>;
}

async function loadChartConfig(
  deps: ChartsDeps, projectId: string): Promise<ChartConfigEntry[] | null> {
  const cacheKey = `${CONFIG_CACHE_PREFIX}${projectId}`;
  try {
    const cached = await deps.kv.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as ChartConfigEntry[];
    }
  } catch {
    // cache miss path — fall through to the source of truth
  }
  try {
    const config = await deps.backends.getChartConfig(projectId);
    try {
      await deps.kv.set(cacheKey, JSON.stringify(config), deps.chartConfigTtlSeconds);
    } catch {
      // cache write failure must never fail the request
    }
    return config;
  } catch {
    // PARITY (chart_service.py:88-90): config query failed -> null -> ALL charts,
    // multi/historical fall back to default parameters. Never cached.
    return null;
  }
}

function chartAggregateParameters(config: ChartConfigEntry[]): string[] {
  const params = new Set(CHART_AGGREGATE_PARAMETERS);
  for (const entry of config) {
    for (const code of entry.yParameterCodes) {
      params.add(code);
    }
  }
  return [...params];
}

function bucketAveragesToReadings(rows: BucketAverage[]): Reading[] {
  const byTimestamp = new Map<number, Record<string, number>>();
  for (const row of rows) {
    if (row.sampleCount <= 0) {
      continue;
    }
    const timestamp = row.bucketStart.getTime();
    let values = byTimestamp.get(timestamp);
    if (!values) {
      values = {};
      byTimestamp.set(timestamp, values);
    }
    values[row.parameter] = row.average;
  }
  return [...byTimestamp.entries()]
    .sort(([a], [b]) => a - b)
    .map(([timestamp, values]) => ({ timestamp: new Date(timestamp), values }));
}

export function chartsRouter(deps: ChartsDeps): Router {
  const router = Router({ mergeParams: true });
  const packageCache = new Map<string, ChartPackageCacheEntry>();

  function prunePackageCache(now: number): void {
    for (const [key, entry] of packageCache) {
      if (entry.expiresAt <= now) {
        packageCache.delete(key);
      }
    }
    while (packageCache.size > CHART_PACKAGE_CACHE_MAX) {
      const oldest = packageCache.keys().next().value;
      if (oldest === undefined) break;
      packageCache.delete(oldest);
    }
  }

  function packageCacheKey(
    projectId: string,
    pondId: string,
    startDate: string,
    endDate: string,
    grouping: string): string {
    return [projectId, pondId, startDate, endDate, grouping].join('|');
  }

  async function getChartPackage(
    key: string,
    load: () => Promise<ChartPackage>): Promise<ChartPackage> {
    const now = Date.now();
    const cached = packageCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.promise;
    }

    prunePackageCache(now);
    const promise = load().catch((err) => {
      packageCache.delete(key);
      throw err;
    });
    packageCache.set(key, { expiresAt: now + CHART_PACKAGE_TTL_MS, promise });
    return promise;
  }

  router.get('/api/projects/:projectId/charts/', async (req: Request, res: Response) => {
    const principal = req.principal!;
    const { projectId } = req.params;

    // monolith get_object(): RBAC-filtered queryset -> out-of-scope/bad id = 404
    if (!UUID_RE.test(projectId) || !hasProjectAccess(principal.snapshot, projectId)) {
      res.status(404).json({ detail: 'Not found.' });
      return;
    }

    const pondId = req.query.pondId;
    if (typeof pondId !== 'string' || pondId.length === 0) {
      res.status(400).json({ error: 'pondId query parameter required' });
      return;
    }

    try {
      const pondOk = await deps.backends.validatePondInProject(pondId, projectId);
      if (!pondOk) {
        res.status(404).json({ error: 'Pond not found in this project' });
        return;
      }

      const startDateStr = typeof req.query.startDate === 'string' ? req.query.startDate : '';
      const endDateStr = typeof req.query.endDate === 'string' ? req.query.endDate : '';
      const grouping = typeof req.query.grouping === 'string' ? req.query.grouping : 'auto';

      if (!startDateStr || !endDateStr) {
        res.status(400).json({ error: 'startDate and endDate are required.' });
        return;
      }
      const startDate = parseIsoDate(startDateStr);
      const endDate = parseIsoDate(endDateStr);
      if (startDate === null || endDate === null) {
        res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
        return;
      }

      // (end - start).days — integer, may be negative; no start<=end validation (parity)
      const daysInRange = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
      const resolvedGrouping = resolveGrouping(grouping, daysInRange);

      const config = await loadChartConfig(deps, projectId);

      // monolith get_readings window: [start 00:00:00, end 23:59:59.999999] in the
      // ACTIVE timezone (Asia/Singapore — config/settings/base.py)
      const tz = timezoneSuffix();
      const startLocalIso = `${startDateStr}T00:00:00${tz}`;
      const endLocalIso = `${endDateStr}T23:59:59.999999${tz}`;
      const startInstantIso = new Date(startLocalIso).toISOString();
      const endInstantIso = new Date(`${endDateStr}T23:59:59.999${tz}`).toISOString();

      if (config !== null) {
        const key = packageCacheKey(projectId, pondId, startDateStr, endDateStr, resolvedGrouping);
        const body = await getChartPackage(key, async () => {
          let readings: Reading[] = [];
          try {
            const buckets = await deps.backends.getPondParameterBucketAverages(
              pondId,
              startInstantIso,
              endInstantIso,
              CHART_TIMEZONE,
              resolvedGrouping,
              chartAggregateParameters(config));
            readings = bucketAveragesToReadings(buckets);
          } catch {
            packageCache.delete(key);
          }
          return buildHistoricalChartPackage(readings, config, resolvedGrouping);
        });
        res.json(body);
        return;
      }

      let readings: Reading[];
      try {
        readings = await deps.backends.getReadings(pondId, startLocalIso, endLocalIso);
      } catch {
        readings = []; // PARITY: get_readings swallows errors -> [] -> empty package
      }
      res.json(buildHistoricalChartPackage(readings, config, resolvedGrouping));
    } catch (err) {
      // pond service transport failure — no monolith equivalent (in-process there)
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
