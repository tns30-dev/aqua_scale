import {
  apiGet,
  bootstrapSession,
  envInt,
  pickOne,
  qs,
  sleepBetween,
  twoPonds,
} from './common.js';
import { Trend } from 'k6/metrics';

const RUNS = envInt('RUNS', 20);
const DAYS = envInt('LOADTEST_DAYS', 30);
const WINDOW_END = __ENV.LOADTEST_END_DATE || '2026-07-31';
const WINDOW_START = dateMinusDays(WINDOW_END, DAYS);

const summaryTrend = new Trend('growth_summary_ms', true);
const chartsTrend = new Trend('growth_charts_ms', true);
const comparisonTrend = new Trend('growth_pond_comparison_ms', true);
const energyTrend = new Trend('growth_energy_ms', true);
const feedingOptionsTrend = new Trend('growth_feeding_options_ms', true);
const feedingDashboardTrend = new Trend('growth_feeding_dashboard_ms', true);

export const options = {
  noCookiesReset: true,
  scenarios: {
    growth_probe: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: RUNS,
      maxDuration: __ENV.MAX_DURATION || '30m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
};

let session;

export default function () {
  if (!session) session = bootstrapSession();
  if (!session.ready) return;

  const pond = pickOne(session.pondIds);
  const pair = twoPonds(session);

  timedGet(`/api/projects/${session.projectId}/summary`, 'C growth: summary', summaryTrend);

  if (pond) {
    timedGet(
      `/api/projects/${session.projectId}/charts/${qs({
        pondId: pond,
        startDate: WINDOW_START,
        endDate: WINDOW_END,
        grouping: 'daily',
      })}`,
      'C growth: charts',
      chartsTrend,
    );
  }

  if (pair) {
    timedGet(
      `/api/projects/${session.projectId}/pond-comparison${qs({
        pondAId: pair[0],
        pondBId: pair[1],
        startDate: WINDOW_START,
        endDate: WINDOW_END,
        grouping: 'auto',
      })}`,
      'C growth: pond comparison',
      comparisonTrend,
    );
  }

  timedGet(
    `/api/projects/${session.projectId}/energy/dashboard/${qs({
      startDate: WINDOW_START,
      endDate: WINDOW_END,
      groupBy: 'day',
    })}`,
    'C growth: energy',
    energyTrend,
  );

  timedGet(
    `/api/projects/${session.projectId}/feeding/options/`,
    'C growth: feeding options',
    feedingOptionsTrend,
  );
  if (session.cycleId) {
    timedGet(
      `/api/projects/${session.projectId}/feeding/dashboard/${qs({ cycle: session.cycleId })}`,
      'C growth: feeding dashboard',
      feedingDashboardTrend,
    );
  }

  sleepBetween(0.1, 0.3);
}

function timedGet(path, name, trend) {
  const response = apiGet(path, name);
  trend.add(response.timings.duration);
  return response;
}

function dateMinusDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
