/** Env configuration — defaults match the local compose stack (pg 5433 / redis 6380). */
export interface Config {
  port: number;
  jwtPublicKeyPem: string;
  jwtIssuer: string;
  jwtAudience: string;
  redisUrl: string;
  protoDir: string;
  projectGrpcTarget: string;
  pondGrpcTarget: string;
  ingestionGrpcTarget: string;
  chartConfigTtlSeconds: number;
  /** monolith TIME_ZONE = Asia/Singapore (+480); fixed offset, no DST */
  tzOffsetMinutes: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 8090),
    jwtPublicKeyPem: env.JWT_PUBLIC_KEY_PEM ?? '',
    jwtIssuer: env.JWT_ISSUER ?? 'aquashield-local',
    jwtAudience: env.JWT_AUDIENCE ?? 'aquashield-api',
    redisUrl: env.REDIS_URL ?? 'redis://localhost:6380',
    protoDir: env.PROTO_DIR ?? `${__dirname}/../../shared-api/src/main/proto`,
    projectGrpcTarget: env.PROJECT_GRPC_TARGET ?? 'localhost:9092',
    pondGrpcTarget: env.POND_GRPC_TARGET ?? 'localhost:9094',
    ingestionGrpcTarget: env.INGESTION_GRPC_TARGET ?? 'localhost:9095',
    chartConfigTtlSeconds: Number(env.CHART_CONFIG_CACHE_TTL_SECONDS ?? 60),
    tzOffsetMinutes: Number(env.TZ_OFFSET_MINUTES ?? 480),
  };
}
