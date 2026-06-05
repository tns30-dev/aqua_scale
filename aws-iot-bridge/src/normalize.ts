import { randomUUID } from "crypto";

const RULE_METADATA_FIELDS = new Set([
  "aws_iot_timestamp",
  "mqtt_device_code",
  "mqtt_topic",
  "topic",
]);

export interface SensorReading {
  parameter: string;
  value: number;
}

export interface SensorBatch {
  port: string;
  readings: SensorReading[];
}

export interface IngestionPayload {
  device_code: string;
  seq_no: number;
  measured_at: string;
  ts: number;
  sensor_batches: SensorBatch[];
  sig?: string;
}

export interface PubSubEnvelope {
  eventId: string;
  eventType: "iot.telemetry.received";
  schemaVersion: "v1";
  occurredAt: string;
  publishedAt: string;
  source: string;
  correlationId: string;
  causationId: string | null;
  projectId: string | null;
  pondId: string | null;
  payload: IngestionPayload;
}

export interface NormalizeOptions {
  source?: string;
  now?: () => Date;
  eventId?: () => string;
}

export function normalizeIotEvent(
  event: Record<string, unknown>,
  options: NormalizeOptions = {},
): PubSubEnvelope {
  const now = options.now ?? (() => new Date());
  const eventId = options.eventId ?? randomUUID;
  const mqttDeviceCode = stringValue(event.mqtt_device_code);
  const payload = stripRuleMetadata(event);

  if (!payload.device_code && mqttDeviceCode && !payload.sig) {
    payload.device_code = mqttDeviceCode;
  }

  assertIngestionPayload(payload);

  const publishedAt = now().toISOString();
  const occurredAt = toIsoString(payload.measured_at);
  return {
    eventId: eventId(),
    eventType: "iot.telemetry.received",
    schemaVersion: "v1",
    occurredAt,
    publishedAt,
    source: options.source ?? "aws-iot-lambda-bridge",
    correlationId: stringValue(event.correlationId) ?? eventId(),
    causationId: null,
    projectId: null,
    pondId: null,
    payload,
  };
}

function stripRuleMetadata(event: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (!RULE_METADATA_FIELDS.has(key)) {
      payload[key] = value;
    }
  }
  return payload;
}

function assertIngestionPayload(
  value: Record<string, unknown>,
): asserts value is Record<string, unknown> & IngestionPayload {
  requireText(value, "device_code");
  requireInteger(value, "seq_no");
  requireText(value, "measured_at");
  requireInteger(value, "ts");

  if (!Array.isArray(value.sensor_batches) || value.sensor_batches.length === 0) {
    throw new Error("sensor_batches must be a non-empty array");
  }
  for (const batch of value.sensor_batches) {
    if (!isRecord(batch)) {
      throw new Error("sensor_batches entries must be objects");
    }
    requireText(batch, "port");
    if (!Array.isArray(batch.readings) || batch.readings.length === 0) {
      throw new Error("readings must be a non-empty array");
    }
    for (const reading of batch.readings) {
      if (!isRecord(reading)) {
        throw new Error("readings entries must be objects");
      }
      requireText(reading, "parameter");
      if (typeof reading.value !== "number" || !Number.isFinite(reading.value)) {
        throw new Error("reading.value must be a finite number");
      }
    }
  }
}

function requireText(value: Record<string, unknown>, key: string): string {
  const text = stringValue(value[key]);
  if (!text) {
    throw new Error(`${key} is required`);
  }
  return text;
}

function requireInteger(value: Record<string, unknown>, key: string): number {
  const raw = value[key];
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    throw new Error(`${key} must be an integer`);
  }
  return raw;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toIsoString(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("measured_at must be an ISO date-time");
  }
  return parsed.toISOString();
}
