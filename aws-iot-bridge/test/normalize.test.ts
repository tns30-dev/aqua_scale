import { describe, expect, it } from "vitest";
import { normalizeIotEvent } from "../src/normalize";

const now = () => new Date("2026-06-05T06:10:00.000Z");

describe("normalizeIotEvent", () => {
  it("wraps signed telemetry without keeping AWS IoT rule metadata", () => {
    const envelope = normalizeIotEvent({
      device_code: "DEV-CLOUD-SMOKE-001",
      seq_no: 42,
      measured_at: "2026-06-05T06:09:00Z",
      ts: 1780639740,
      sig: "abc123",
      mqtt_topic: "aquashield/dev/telemetry/DEV-CLOUD-SMOKE-001",
      mqtt_device_code: "DEV-CLOUD-SMOKE-001",
      aws_iot_timestamp: 1780639800000,
      sensor_batches: [
        {
          port: "A1",
          readings: [{ parameter: "ph", value: 9.2 }],
        },
      ],
    }, {
      now,
      eventId: () => "event-1",
      source: "test-bridge",
    });

    expect(envelope).toMatchObject({
      eventId: "event-1",
      eventType: "iot.telemetry.received",
      schemaVersion: "v1",
      occurredAt: "2026-06-05T06:09:00.000Z",
      publishedAt: "2026-06-05T06:10:00.000Z",
      source: "test-bridge",
      projectId: null,
      pondId: null,
    });
    expect(envelope.payload).not.toHaveProperty("mqtt_topic");
    expect(envelope.payload).not.toHaveProperty("aws_iot_timestamp");
    expect(envelope.payload.sig).toBe("abc123");
  });

  it("uses MQTT topic device code only for unsigned development payloads", () => {
    const envelope = normalizeIotEvent({
      seq_no: 7,
      measured_at: "2026-06-05T06:09:00Z",
      ts: 1780639740,
      mqtt_device_code: "DEV-FROM-TOPIC",
      sensor_batches: [
        {
          port: "A1",
          readings: [{ parameter: "temperature", value: 28.1 }],
        },
      ],
    }, {
      now,
      eventId: () => "event-2",
    });

    expect(envelope.payload.device_code).toBe("DEV-FROM-TOPIC");
  });

  it("rejects payloads that ingestion would reject", () => {
    expect(() => normalizeIotEvent({
      device_code: "DEV-BAD",
      seq_no: 1,
      measured_at: "2026-06-05T06:09:00Z",
      ts: 1780639740,
    })).toThrow("sensor_batches must be a non-empty array");
  });
});
