import {
  apiGet,
  bootstrapSession,
  envInt,
  qs,
  twoPonds,
} from './common.js';
import { sleep } from 'k6';

const TARGET = (__ENV.HERD_TARGET || 'summary').toLowerCase();
const VUS = envInt('VUS', 50);
const DAYS = envInt('LOADTEST_DAYS', 30);
const WINDOW_END = __ENV.LOADTEST_END_DATE || '2026-07-31';
const WINDOW_START = dateMinusDays(WINDOW_END, DAYS);

export const options = {
  noCookiesReset: true,
  scenarios: {
    herd: {
      executor: 'constant-vus',
      vus: VUS,
      duration: __ENV.DURATION || '2m',
      gracefulStop: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2500'],
    'http_req_duration{name:B3 herd: pond comparison}': ['p(95)<4000'],
  },
};

let session;

export default function () {
  if (!session || !session.ready) session = bootstrapSession();
  if (!session.ready) {
    sleep(1);
    return;
  }

  if (TARGET === 'comparison') {
    const pair = twoPonds(session);
    if (!pair) return;
    apiGet(
      `/api/projects/${session.projectId}/pond-comparison${qs({
        pondAId: pair[0],
        pondBId: pair[1],
        startDate: WINDOW_START,
        endDate: WINDOW_END,
        grouping: 'auto',
      })}`,
      'B3 herd: pond comparison',
    );
    return;
  }

  if (TARGET === 'alerts') {
    apiGet(`/api/alerts${qs({ projectId: session.projectId })}`, 'B3 herd: alerts');
    return;
  }

  if (TARGET === 'energy') {
    apiGet(
      `/api/projects/${session.projectId}/energy/dashboard/${qs({
        startDate: WINDOW_START,
        endDate: WINDOW_END,
        groupBy: 'day',
      })}`,
      'B3 herd: energy',
    );
    return;
  }

  if (TARGET === 'charts') {
    apiGet(
      `/api/projects/${session.projectId}/charts/${qs({
        pondId: session.pondIds[0],
        startDate: WINDOW_START,
        endDate: WINDOW_END,
        grouping: 'daily',
      })}`,
      'B3 herd: charts',
    );
    return;
  }

  apiGet(`/api/projects/${session.projectId}/summary`, 'B3 herd: summary');
}

function dateMinusDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
