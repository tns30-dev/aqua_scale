import Redis from 'ioredis';
import { JwtVerifier, KV } from './auth/auth';
import { createApp } from './app';
import { setTimezoneOffsetMinutes } from './charts/engine';
import { loadConfig } from './config';
import { createGrpcBackends } from './grpc/backends';

const config = loadConfig();
setTimezoneOffsetMinutes(config.tzOffsetMinutes);

if (!config.jwtPublicKeyPem) {
  // fail fast: without Identity's public key every request would 401 anyway
  console.error('JWT_PUBLIC_KEY_PEM is required');
  process.exit(1);
}

const redis = new Redis(config.redisUrl);
const kv: KV = {
  get: (key) => redis.get(key),
  set: async (key, value, ttlSeconds) => {
    await redis.set(key, value, 'EX', ttlSeconds);
  },
};

const backends = createGrpcBackends({
  protoDir: config.protoDir,
  projectTarget: config.projectGrpcTarget,
  pondTarget: config.pondGrpcTarget,
  ingestionTarget: config.ingestionGrpcTarget,
});

const app = createApp({
  verifier: new JwtVerifier(config.jwtPublicKeyPem, config.jwtIssuer, config.jwtAudience),
  kv,
  backends,
  chartConfigTtlSeconds: config.chartConfigTtlSeconds,
});

const server = app.listen(config.port, () => {
  console.log(`analytics-service listening on :${config.port}`);
});

function shutdown(): void {
  server.close(() => {
    backends.close();
    redis.quit().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
