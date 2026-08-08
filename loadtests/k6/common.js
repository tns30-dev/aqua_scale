import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

export const BASE_URL = normalizeBase(__ENV.BASE_URL || __ENV.K6_BASE_URL || 'http://localhost:8080');
export const WS_URL = __ENV.WS_URL || `${BASE_URL.replace(/^http/, 'ws')}/ws`;
export const PROJECT_NAME = __ENV.LOADTEST_PROJECT_NAME || 'Demo Shrimp Farm';
export const PASSWORD = __ENV.LOADTEST_PASSWORD || 'AdminBoot123!';

const SINGLE_EMAIL = __ENV.LOADTEST_EMAIL || 'admin@aquashield.local';
const EMAIL_TEMPLATE = __ENV.LOADTEST_EMAIL_TEMPLATE || '';
const ACCOUNT_COUNT = envInt('LOADTEST_ACCOUNT_COUNT', 50);

function normalizeBase(value) {
  return String(value || '').replace(/\/+$/, '');
}

export function envInt(name, fallback) {
  const parsed = Number.parseInt(__ENV[name] || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function envFloat(name, fallback) {
  const parsed = Number.parseFloat(__ENV[name] || '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function sleepBetween(minSeconds, maxSeconds) {
  sleep(minSeconds + Math.random() * Math.max(0, maxSeconds - minSeconds));
}

export function url(path) {
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function qs(params) {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function parseJson(response, fallback = {}) {
  try {
    return response.json();
  } catch {
    return fallback;
  }
}

export function expectStatus(response, name, statuses = [200]) {
  const ok = statuses.includes(response.status);
  if (!ok && (__ENV.DEBUG_FAILURES || '').toLowerCase() === 'true') {
    console.log(`${name} failed: status=${response.status} url=${response.url} body=${String(response.body || '').slice(0, 240)}`);
  }
  return check(response, {
    [`${name} status ${statuses.join('/')}`]: (r) => statuses.includes(r.status),
  });
}

export function apiGet(path, name) {
  const response = http.get(url(path), {
    tags: { name },
    timeout: '60s',
  });
  expectStatus(response, name);
  return response;
}

export function apiRequest(session, method, path, body, name) {
  const headers = {
    'X-CSRFToken': session.csrfToken,
  };
  let payload = null;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = http.request(method, url(path), payload, {
    headers,
    tags: { name },
    timeout: '60s',
  });
  expectStatus(response, name, method === 'POST' && path === '/api/users' ? [201] : [200, 204]);
  return response;
}

export function pickOne(values) {
  if (!values || values.length === 0) return null;
  return values[Math.floor(Math.random() * values.length)];
}

export function twoPonds(session) {
  if (!session.pondIds || session.pondIds.length < 2) return null;
  return [session.pondIds[0], session.pondIds[1]];
}

export function bootstrapSession() {
  const csrfResponse = http.get(url('/api/csrf'), {
    tags: { name: 'setup GET /api/csrf' },
    timeout: '30s',
  });
  const csrfBody = parseJson(csrfResponse);
  const csrfToken = csrfBody.csrfToken || csrfBody.csrf || '';
  const csrfOk = expectStatus(csrfResponse, 'setup GET /api/csrf') && Boolean(csrfToken);
  check({ csrfToken }, {
    'setup csrf token present': (value) => Boolean(value.csrfToken),
  });
  if (!csrfOk) return { ready: false, csrfToken };

  const loginResponse = http.post(
    url('/api/auth/login'),
    JSON.stringify({ email: emailForVu(), password: PASSWORD }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      tags: { name: 'setup POST /api/auth/login' },
      timeout: '30s',
    },
  );
  if (!expectStatus(loginResponse, 'setup POST /api/auth/login')) {
    return { ready: false, csrfToken };
  }

  const meResponse = apiGet('/api/auth/me', 'setup GET /api/auth/me');
  const meBody = parseJson(meResponse);
  const projects = Array.isArray(meBody.projects) ? meBody.projects : [];
  const project = projects.find((row) => row.name === PROJECT_NAME) || projects[0];
  const projectId = projectIdFrom(project);
  if (!projectId) return { ready: false, csrfToken };

  const pondsResponse = apiGet(`/api/ponds${qs({ projectId })}`, 'setup GET /api/ponds');
  const pondsBody = parseJson(pondsResponse);
  const pondRows = Array.isArray(pondsBody) ? pondsBody : pondsBody.ponds || [];
  const pondIds = pondRows.map(pondIdFrom).filter(Boolean);

  let cycleId = null;
  if (pondIds.length > 0) {
    const cyclesResponse = apiGet(`/api/cycles${qs({ pond: pondIds[0] })}`, 'setup GET /api/cycles');
    const cyclesBody = parseJson(cyclesResponse);
    const cycleRows = Array.isArray(cyclesBody) ? cyclesBody : cyclesBody.results || cyclesBody.cycles || [];
    cycleId = cycleRows.length > 0 ? cycleIdFrom(cycleRows[0]) : null;
  }

  return {
    ready: Boolean(projectId && pondIds.length > 0),
    csrfToken,
    projectId,
    pondIds,
    cycleId,
  };
}

function emailForVu() {
  if (!EMAIL_TEMPLATE) return SINGLE_EMAIL;
  const id = ((exec.vu.idInTest || 1) - 1) % ACCOUNT_COUNT + 1;
  return EMAIL_TEMPLATE
    .replace('{:03d}', String(id).padStart(3, '0'))
    .replace('%03d', String(id).padStart(3, '0'))
    .replace('{}', String(id))
    .replace('{n}', String(id));
}

function projectIdFrom(row) {
  return row && (row.projectId || row.project_id);
}

function pondIdFrom(row) {
  return row && (row.pondId || row.pond_id);
}

function cycleIdFrom(row) {
  return row && (row.cycleId || row.cycle_id);
}
