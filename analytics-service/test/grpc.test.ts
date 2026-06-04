/**
 * Real-gRPC wiring test: loads the ACTUAL shared-api protos and round-trips through a
 * @grpc/grpc-js server — proves proto paths, snake_case field mapping and the
 * map<string,double> values decode that the chart engine depends on.
 */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGrpcBackends } from '../src/grpc/backends';

const PROTO_DIR = path.join(__dirname, '..', '..', 'shared-api', 'src', 'main', 'proto');

/* eslint-disable @typescript-eslint/no-explicit-any */
function service(file: string, pkg: string, name: string): any {
  const def = protoLoader.loadSync(path.join(PROTO_DIR, file), {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
  });
  let node: any = grpc.loadPackageDefinition(def);
  for (const part of pkg.split('.')) {
    node = node[part];
  }
  return node[name];
}

let server: grpc.Server;
let backends: ReturnType<typeof createGrpcBackends>;

beforeAll(async () => {
  server = new grpc.Server();

  server.addService(service('project.proto', 'aquashield.project.v1', 'ProjectService').service, {
    GetChartConfig: (call: any, callback: any) => {
      expect(call.request.project_id).toBe('p-1');
      callback(null, {
        project_id: call.request.project_id,
        charts: [{
          project_visualisation_id: 'pv-1',
          visualisation_name: 'Multi-Parameter Trends',
          chart_type: 'line',
          title: '',
          y_parameter_codes: ['temperature', 'ph'],
        }],
      });
    },
  } as any);

  server.addService(service('pond.proto', 'aquashield.pond.v1', 'PondService').service, {
    ValidatePondInProject: (call: any, callback: any) => {
      callback(null, { valid: call.request.pond_id === 'pond-1' });
    },
  } as any);

  server.addService(
    service('ingestion.proto', 'aquashield.ingestion.v1', 'IngestionReadService').service, {
      GetReadings: (call: any, callback: any) => {
        expect(call.request.start).toBe('2026-03-17T00:00:00Z');
        callback(null, {
          pond_id: call.request.pond_id,
          truncated: false,
          rows: [{
            measured_at: '2026-03-17T08:00:00Z',
            project_sensor_id: 'ps-1',
            port: 'P1',
            values: { ph: 7.2, temperature: 28.5 },
          }],
        });
      },
    } as any);

  const port = await new Promise<number>((resolve, reject) => {
    server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(),
      (err, boundPort) => (err ? reject(err) : resolve(boundPort)));
  });

  backends = createGrpcBackends({
    protoDir: PROTO_DIR,
    projectTarget: `127.0.0.1:${port}`,
    pondTarget: `127.0.0.1:${port}`,
    ingestionTarget: `127.0.0.1:${port}`,
  });
});

afterAll(() => {
  backends.close();
  server.forceShutdown();
});

describe('gRPC client wiring against the shared-api protos', () => {
  it('GetChartConfig maps snake_case fields to the engine config shape', async () => {
    const config = await backends.getChartConfig('p-1');
    expect(config).toEqual([{
      projectVisualisationId: 'pv-1',
      visualisationName: 'Multi-Parameter Trends',
      yParameterCodes: ['temperature', 'ph'],
    }]);
  });

  it('ValidatePondInProject returns the valid flag', async () => {
    await expect(backends.validatePondInProject('pond-1', 'p-1')).resolves.toBe(true);
    await expect(backends.validatePondInProject('pond-2', 'p-1')).resolves.toBe(false);
  });

  it('GetReadings decodes map<string,double> values and measured_at', async () => {
    const readings = await backends.getReadings(
      'pond-1', '2026-03-17T00:00:00Z', '2026-03-17T23:59:59.999999Z');
    expect(readings).toHaveLength(1);
    expect(readings[0].timestamp.toISOString()).toBe('2026-03-17T08:00:00.000Z');
    expect(readings[0].values).toEqual({ ph: 7.2, temperature: 28.5 });
  });
});
