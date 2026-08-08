import {
  apiGet,
  apiRequest,
  bootstrapSession,
  envInt,
  pickOne,
  qs,
  sleepBetween,
  twoPonds,
} from './common.js';

const VUS = envInt('VUS', 10);
const DAYS = envInt('LOADTEST_DAYS', 30);
const ENABLE_WRITES = (__ENV.ENABLE_WRITES || 'false').toLowerCase() === 'true';
const WINDOW_END = __ENV.LOADTEST_END_DATE || '2026-07-31';
const WINDOW_START = dateMinusDays(WINDOW_END, DAYS);

export const options = {
  noCookiesReset: true,
  scenarios: {
    busy_day: {
      executor: 'ramping-vus',
      stages: [
        { duration: __ENV.RAMP_UP || '1m', target: VUS },
        { duration: __ENV.HOLD || '3m', target: VUS },
        { duration: __ENV.RAMP_DOWN || '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
    'http_req_duration{name:A4 GET charts}': ['p(95)<3500'],
    'http_req_duration{name:A5 GET pond comparison}': ['p(95)<3500'],
  },
};

let session;

export default function () {
  if (!session) session = bootstrapSession();
  if (!session.ready) {
    sleepBetween(1, 2);
    return;
  }

  const roll = Math.random() * 100;
  if (roll < 24) overview(session);
  else if (roll < 38) digitalTwin(session);
  else if (roll < 50) alerts(session);
  else if (roll < 63) historical(session);
  else if (roll < 74) energy(session);
  else if (roll < 84) feeding(session);
  else if (roll < 93) pondComparison(session);
  else if (roll < 98) treatmentStability(session);
  else if (ENABLE_WRITES) recordFeeding(session);

  sleepBetween(1, 4);
}

function overview(s) {
  apiGet(`/api/projects/${s.projectId}/summary`, 'A2 GET summary');
  apiGet(`/api/ponds${qs({ projectId: s.projectId })}`, 'A2 GET ponds');
  apiGet(
    `/api/ponds/latest-readings${qs({ projectId: s.projectId, ponds: s.pondIds.join(',') })}`,
    'A2 GET latest readings',
  );
}

function digitalTwin(s) {
  apiGet(`/api/ponds${qs({ projectId: s.projectId })}`, 'A3 GET ponds');
}

function historical(s) {
  const pond = pickOne(s.pondIds);
  if (!pond) return;
  apiGet(
    `/api/projects/${s.projectId}/charts/${qs({
      pondId: pond,
      startDate: WINDOW_START,
      endDate: WINDOW_END,
      grouping: 'daily',
    })}`,
    'A4 GET charts',
  );
  if (s.cycleId) apiGet(`/api/cycles/${s.cycleId}/details/`, 'A4 GET cycle details');
}

function pondComparison(s) {
  const pair = twoPonds(s);
  if (!pair) return;
  apiGet(
    `/api/projects/${s.projectId}/pond-comparison${qs({
      pondAId: pair[0],
      pondBId: pair[1],
      startDate: WINDOW_START,
      endDate: WINDOW_END,
      grouping: 'auto',
    })}`,
    'A5 GET pond comparison',
  );
}

function energy(s) {
  apiGet(
    `/api/projects/${s.projectId}/energy/dashboard/${qs({
      startDate: WINDOW_START,
      endDate: WINDOW_END,
      groupBy: 'day',
    })}`,
    'A6 GET energy dashboard',
  );
}

function feeding(s) {
  apiGet(`/api/projects/${s.projectId}/feeding/options/`, 'A7 GET feeding options');
  if (s.cycleId) {
    apiGet(
      `/api/projects/${s.projectId}/feeding/dashboard/${qs({ cycle: s.cycleId })}`,
      'A7 GET feeding dashboard',
    );
  }
}

function treatmentStability(s) {
  const pond = pickOne(s.pondIds);
  if (!pond) return;
  const response = apiGet(`/api/pond-treatments/${qs({ pond })}`, 'A8 GET pond treatments');
  const body = response.json();
  const rows = Array.isArray(body) ? body : body.results || [];
  if (rows.length === 0) return;
  const courseId = rows[0].pond_treatment_id || rows[0].pondTreatmentId || rows[0].id || rows[0].courseId;
  if (!courseId) return;
  apiGet(
    `/api/pond-treatments/stability/${qs({ pond, courses: courseId })}`,
    'A8 GET stability',
  );
}

function alerts(s) {
  apiGet(`/api/alerts${qs({ projectId: s.projectId })}`, 'A9 GET alerts');
}

function recordFeeding(s) {
  const pond = pickOne(s.pondIds);
  if (!pond) return;
  const day = randomDate(WINDOW_START, WINDOW_END);
  apiRequest(s, 'PUT', `/api/ponds/${pond}/feed-days/${day}/`, { entries: [] }, 'A10 PUT feed day');
}

function dateMinusDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function randomDate(startIso, endIso) {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  const value = start + Math.random() * Math.max(0, end - start);
  return new Date(value).toISOString().slice(0, 10);
}
