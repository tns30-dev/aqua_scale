import express from 'express';
import type { Express } from 'express';
import { authMiddleware, JwtVerifier, KV } from './auth/auth';
import type { Backends } from './grpc/backends';
import { chartsRouter } from './routes/charts';

export interface AppDeps {
  verifier: JwtVerifier;
  kv: KV;
  backends: Backends;
  chartConfigTtlSeconds: number;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'UP' });
  });

  app.use(authMiddleware(deps.verifier, deps.kv));
  app.use(chartsRouter({
    backends: deps.backends,
    kv: deps.kv,
    chartConfigTtlSeconds: deps.chartConfigTtlSeconds,
  }));

  return app;
}
