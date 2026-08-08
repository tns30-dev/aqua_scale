/**
 * Route contract tests: monolith validation order + exact error bodies, the platform
 * auth model (RS256 JWT + fail-closed Redis snapshot), chart-config metadata caching,
 * and the no-raw-readings-in-Redis rule (main/analytics_service.md).
 */
import { generateKeyPairSync, KeyObject, randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { JwtVerifier, KV } from '../src/auth/auth';
import type { Backends, BucketAverage } from '../src/grpc/backends';
import type { ChartConfigEntry, Reading } from '../src/charts/engine';

const ISSUER = 'aquashield-local';
const AUDIENCE = 'aquashield-api';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PUBLIC_PEM = (publicKey as KeyObject).export({ type: 'spki', format: 'pem' }) as string;

const USER = randomUUID();
const PROJECT = randomUUID();
const OTHER_PROJECT = randomUUID();
const POND = randomUUID();

async function mintToken(userId: string, authzVersion = 1, role = 'admin'): Promise<string> {
  return new SignJWT({ role, authzVersion })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(privateKey);
}

class MemoryKV implements KV {
  store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  async set(key: string, value: string, _ttlSeconds: number): Promise<void> {
    this.store.set(key, value);
  }
}

interface FakeBackends extends Backends {
  chartConfigCalls: number;
  readingsCalls: number;
  bucketCalls: number;
  lastReadingsArgs: string[];
  lastBucketArgs: unknown[];
}

function fakeBackends(opts: {
  config?: ChartConfigEntry[] | 'error';
  readings?: Reading[] | 'error';
  buckets?: BucketAverage[] | 'error';
  pondValid?: boolean;
}): FakeBackends {
  const backends: FakeBackends = {
    chartConfigCalls: 0,
    readingsCalls: 0,
    bucketCalls: 0,
    lastReadingsArgs: [],
    lastBucketArgs: [],
    async getChartConfig(_projectId: string): Promise<ChartConfigEntry[]> {
      backends.chartConfigCalls += 1;
      if (opts.config === 'error') {
        throw new Error('UNAVAILABLE');
      }
      return opts.config ?? [];
    },
    async validatePondInProject(_pondId: string, _projectId: string): Promise<boolean> {
      return opts.pondValid ?? true;
    },
    async getReadings(pondId: string, startIso: string, endIso: string): Promise<Reading[]> {
      backends.readingsCalls += 1;
      backends.lastReadingsArgs = [pondId, startIso, endIso];
      if (opts.readings === 'error') {
        throw new Error('UNAVAILABLE');
      }
      return opts.readings ?? [];
    },
    async getPondParameterBucketAverages(
      pondId: string,
      startIso: string,
      endIso: string,
      timezone: string,
      grouping: string,
      parameters: string[]): Promise<BucketAverage[]> {
      backends.bucketCalls += 1;
      backends.lastBucketArgs = [pondId, startIso, endIso, timezone, grouping, parameters];
      if (opts.buckets === 'error') {
        throw new Error('UNAVAILABLE');
      }
      return opts.buckets ?? BUCKETS;
    },
  };
  return backends;
}

function snapshotJson(userId: string, version: number, projectIds: string[]): string {
  return JSON.stringify({
    userId, version, roleType: 'admin',
    features: [{ feature_access: '*', action_controls: ['*'] }],
    projectIds, pondIdsByProject: {}, deviceIdsByProject: {}, deniedFeatures: [],
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

const READINGS: Reading[] = [
  { timestamp: new Date('2026-03-17T08:00:00+08:00'), values: { temperature: 28.0, ph: 7.8 } },
  { timestamp: new Date('2026-03-17T20:00:00+08:00'), values: { temperature: 29.0, ph: 7.9 } },
];

const BUCKETS: BucketAverage[] = [
  {
    bucketStart: new Date('2026-03-17T00:00:00+08:00'),
    parameter: 'temperature',
    average: 28.5,
    sampleCount: 2,
  },
  {
    bucketStart: new Date('2026-03-17T00:00:00+08:00'),
    parameter: 'ph',
    average: 7.85,
    sampleCount: 2,
  },
];

const CONFIG: ChartConfigEntry[] = [
  {
    projectVisualisationId: randomUUID(),
    visualisationName: 'Multi-Parameter Trends',
    yParameterCodes: ['temperature', 'ph'],
  },
  {
    projectVisualisationId: randomUUID(),
    visualisationName: 'Disease Risk Assessment',
    yParameterCodes: [],
  },
];

function build(opts: Parameters<typeof fakeBackends>[0] = {}) {
  const kv = new MemoryKV();
  kv.store.set(`authz:snapshot:${USER}:1`, snapshotJson(USER, 1, [PROJECT]));
  const backends = fakeBackends({ config: CONFIG, readings: READINGS, ...opts });
  const app = createApp({
    verifier: new JwtVerifier(PUBLIC_PEM, ISSUER, AUDIENCE),
    kv,
    backends,
    chartConfigTtlSeconds: 60,
  });
  return { app, kv, backends };
}

const CHARTS = `/api/projects/${PROJECT}/charts/`;
const QS = `pondId=${POND}&startDate=2026-03-17&endDate=2026-03-18`;

describe('auth — platform model (fail closed)', () => {
  it('no token -> 401', async () => {
    const { app } = build();
    await request(app).get(`${CHARTS}?${QS}`).expect(401);
  });

  it('garbage token -> 401', async () => {
    const { app } = build();
    await request(app).get(`${CHARTS}?${QS}`)
      .set('Authorization', 'Bearer not-a-jwt').expect(401);
  });

  it('valid JWT but NO snapshot -> 401 (fail closed)', async () => {
    const { app } = build();
    const stranger = await mintToken(randomUUID());
    await request(app).get(`${CHARTS}?${QS}`)
      .set('Authorization', `Bearer ${stranger}`).expect(401);
  });

  it('valid JWT in access_token cookie -> authenticated', async () => {
    const { app } = build();
    const token = await mintToken(USER);
    await request(app).get(`${CHARTS}?${QS}`)
      .set('Cookie', [`access_token=${token}`]).expect(200);
  });

  it('project outside snapshot scope -> 404 (parity: filtered queryset)', async () => {
    const { app } = build();
    const token = await mintToken(USER);
    const resp = await request(app).get(`/api/projects/${OTHER_PROJECT}/charts/?${QS}`)
      .set('Authorization', `Bearer ${token}`).expect(404);
    expect(resp.body).toEqual({ detail: 'Not found.' });
  });
});

describe('validation order + exact monolith error bodies (views.py:95-143)', () => {
  it('missing pondId -> 400 verbatim body', async () => {
    const { app } = build();
    const token = await mintToken(USER);
    const resp = await request(app).get(CHARTS)
      .set('Authorization', `Bearer ${token}`).expect(400);
    expect(resp.body).toEqual({ error: 'pondId query parameter required' });
  });

  it('pond not in project -> 404 verbatim body (checked BEFORE dates)', async () => {
    const { app } = build({ pondValid: false });
    const token = await mintToken(USER);
    const resp = await request(app).get(`${CHARTS}?pondId=${POND}`)
      .set('Authorization', `Bearer ${token}`).expect(404);
    expect(resp.body).toEqual({ error: 'Pond not found in this project' });
  });

  it('missing dates -> 400 verbatim body', async () => {
    const { app } = build();
    const token = await mintToken(USER);
    const resp = await request(app).get(`${CHARTS}?pondId=${POND}`)
      .set('Authorization', `Bearer ${token}`).expect(400);
    expect(resp.body).toEqual({ error: 'startDate and endDate are required.' });
  });

  it('bad date format -> 400 verbatim body', async () => {
    const { app } = build();
    const token = await mintToken(USER);
    const resp = await request(app)
      .get(`${CHARTS}?pondId=${POND}&startDate=17-03-2026&endDate=2026-03-18`)
      .set('Authorization', `Bearer ${token}`).expect(400);
    expect(resp.body).toEqual({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  });

  it('impossible calendar date -> 400', async () => {
    const { app } = build();
    const token = await mintToken(USER);
    await request(app)
      .get(`${CHARTS}?pondId=${POND}&startDate=2026-02-30&endDate=2026-03-18`)
      .set('Authorization', `Bearer ${token}`).expect(400);
  });
});

describe('chart package responses', () => {
  it('happy path: only enabled keys; stub chart []; aggregate window is end-of-day inclusive', async () => {
    const { app, backends } = build();
    const token = await mintToken(USER);
    const resp = await request(app).get(`${CHARTS}?${QS}&grouping=daily`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(Object.keys(resp.body).sort()).toEqual(['diseaseRisk', 'multiParameterTrends']);
    expect(resp.body.diseaseRisk).toEqual([]);
    expect(resp.body.multiParameterTrends).toEqual([
      { date: '2026-03-17', label: 'Mar 17', temperature: 28.5, ph: 7.85 },
    ]);
    expect(backends.lastBucketArgs).toEqual([
      POND,
      '2026-03-16T16:00:00.000Z',
      '2026-03-18T15:59:59.999Z',
      'Asia/Singapore',
      'daily',
      expect.arrayContaining(['temperature', 'ph', 'dissolved_oxygen', 'turbidity']),
    ]);
  });

  it('no readings -> full 8-key empty package, HTTP 200', async () => {
    const { app } = build({ buckets: [] });
    const token = await mintToken(USER);
    const resp = await request(app).get(`${CHARTS}?${QS}`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(Object.keys(resp.body)).toHaveLength(8);
    expect(resp.body.correlationHeatmap)
      .toEqual({ parameters: [], parameterLabels: {}, matrix: [] });
  });

  it('ingestion aggregate error behaves like the monolith get_readings catch -> empty package', async () => {
    const { app } = build({ buckets: 'error' });
    const token = await mintToken(USER);
    const resp = await request(app).get(`${CHARTS}?${QS}`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(Object.keys(resp.body)).toHaveLength(8);
  });

  it('chart-config error -> ALL 8 keys with fallback params (parity oracle 12)', async () => {
    const { app } = build({ config: 'error' });
    const token = await mintToken(USER);
    const resp = await request(app).get(`${CHARTS}?${QS}&grouping=daily`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(Object.keys(resp.body)).toHaveLength(8);
    expect(resp.body.multiParameterTrends[0]).toHaveProperty('temperature', 28.5);
  });
});

describe('cache usage rules (main/analytics_service.md cache checklist)', () => {
  it('chart metadata uses Redis and identical chart packages are coalesced in process', async () => {
    const { app, backends } = build();
    const token = await mintToken(USER);
    await request(app).get(`${CHARTS}?${QS}`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    await request(app).get(`${CHARTS}?${QS}`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(backends.chartConfigCalls).toBe(1);
    expect(backends.bucketCalls).toBe(1);
    expect(backends.readingsCalls).toBe(0);
  });

  it('raw readings are never written to Redis', async () => {
    const { app, kv } = build();
    const token = await mintToken(USER);
    await request(app).get(`${CHARTS}?${QS}`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    const keys = [...kv.store.keys()].filter((k) => !k.startsWith('authz:'));
    expect(keys).toEqual([`analytics:chart-config:${PROJECT}`]);
    for (const key of keys) {
      expect(kv.store.get(key)).not.toContain('28.5'); // no reading values in Redis
    }
  });

  it('config gRPC errors are not cached (next request retries the source)', async () => {
    const { app, backends, kv } = build({ config: 'error' });
    const token = await mintToken(USER);
    await request(app).get(`${CHARTS}?${QS}`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect([...kv.store.keys()].filter((k) => k.startsWith('analytics:'))).toEqual([]);
    await request(app).get(`${CHARTS}?${QS}`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(backends.chartConfigCalls).toBe(2);
  });
});
