/**
 * Internal gRPC dependencies (the [XSVC] seams):
 *  - Project Service  GetChartConfig          (chart config ownership: main/analytics_service.md)
 *  - Pond Service     ValidatePondInProject   (the monolith's "pond belongs to project" check)
 *  - Ingestion        GetReadings             (the telemetry READ seam, ingestion.proto)
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'node:path';
import type { ChartConfigEntry, Reading } from '../charts/engine';

export interface Backends {
  /** Enabled chart config rows; throws on transport error (caller maps to fallback). */
  getChartConfig(projectId: string): Promise<ChartConfigEntry[]>;
  /** false for unknown pond, wrong project, or malformed ids. */
  validatePondInProject(pondId: string, projectId: string): Promise<boolean>;
  /** Readings ordered measured_at ASC; throws on transport error. */
  getReadings(pondId: string, startIso: string, endIso: string): Promise<Reading[]>;
}

const LOADER_OPTIONS: protoLoader.Options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

interface GrpcTargets {
  protoDir: string;
  projectTarget: string;
  pondTarget: string;
  ingestionTarget: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = any;

function unary<T>(client: AnyClient, method: string, request: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    client[method](request, (err: grpc.ServiceError | null, resp: T) => {
      if (err) {
        reject(err);
      } else {
        resolve(resp);
      }
    });
  });
}

export function createGrpcBackends(targets: GrpcTargets): Backends & { close(): void } {
  const load = (file: string): grpc.GrpcObject => grpc.loadPackageDefinition(
    protoLoader.loadSync(path.join(targets.protoDir, file), LOADER_OPTIONS));

  const projectPkg: AnyClient = (load('project.proto') as AnyClient).aquashield.project.v1;
  const pondPkg: AnyClient = (load('pond.proto') as AnyClient).aquashield.pond.v1;
  const ingestionPkg: AnyClient = (load('ingestion.proto') as AnyClient).aquashield.ingestion.v1;

  const creds = grpc.credentials.createInsecure(); // in-cluster only (mesh mTLS in k8s)
  const project = new projectPkg.ProjectService(targets.projectTarget, creds);
  const pond = new pondPkg.PondService(targets.pondTarget, creds);
  const ingestion = new ingestionPkg.IngestionReadService(targets.ingestionTarget, creds);

  return {
    async getChartConfig(projectId: string): Promise<ChartConfigEntry[]> {
      const resp = await unary<AnyClient>(project, 'GetChartConfig', { project_id: projectId });
      return (resp.charts ?? []).map((c: AnyClient) => ({
        projectVisualisationId: c.project_visualisation_id,
        visualisationName: c.visualisation_name,
        yParameterCodes: c.y_parameter_codes ?? [],
      }));
    },

    async validatePondInProject(pondId: string, projectId: string): Promise<boolean> {
      try {
        const resp = await unary<AnyClient>(pond, 'ValidatePondInProject',
          { pond_id: pondId, project_id: projectId });
        return resp.valid === true;
      } catch (err) {
        const code = (err as grpc.ServiceError).code;
        if (code === grpc.status.INVALID_ARGUMENT || code === grpc.status.NOT_FOUND) {
          return false; // malformed/unknown pond -> "Pond not found in this project"
        }
        throw err;
      }
    },

    async getReadings(pondId: string, startIso: string, endIso: string): Promise<Reading[]> {
      const resp = await unary<AnyClient>(ingestion, 'GetReadings',
        { pond_id: pondId, start: startIso, end: endIso, parameters: [], limit: 0 });
      return (resp.rows ?? []).map((row: AnyClient) => ({
        timestamp: new Date(row.measured_at),
        values: row.values ?? {},
      }));
    },

    close(): void {
      project.close();
      pond.close();
      ingestion.close();
    },
  };
}
