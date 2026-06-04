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
import type { Backends } from '../grpc/backends';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ChartsDeps {
  backends: Backends;
  kv: KV;
  /** chart METADATA cache TTL — readings are NEVER cached (main/analytics_service.md) */
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

export function chartsRouter(deps: ChartsDeps): Router {
  const router = Router({ mergeParams: true });

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
      let readings: Reading[];
      try {
        readings = await deps.backends.getReadings(
          pondId, `${startDateStr}T00:00:00${tz}`, `${endDateStr}T23:59:59.999999${tz}`);
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
