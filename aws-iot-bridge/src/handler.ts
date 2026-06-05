import { existsSync, writeFileSync } from "fs";
import { PubSub } from "@google-cloud/pubsub";
import { normalizeIotEvent } from "./normalize";

let pubsub: PubSub | undefined;

export async function handler(event: Record<string, unknown>) {
  const envelope = normalizeIotEvent(event, {
    source: process.env.EVENT_SOURCE ?? "aws-iot-lambda-bridge",
  });

  const topicName = requiredEnv("PUBSUB_TOPIC");
  const topic = getPubSub().topic(topicName);
  const messageId = await topic.publishMessage({
    json: envelope,
    attributes: {
      eventType: envelope.eventType,
      schemaVersion: envelope.schemaVersion,
      source: envelope.source,
      correlationId: envelope.correlationId,
    },
  });

  console.log(JSON.stringify({
    eventId: envelope.eventId,
    messageId,
    topic: topicName,
    deviceCode: envelope.payload.device_code,
    seqNo: envelope.payload.seq_no,
  }));

  return {
    ok: true,
    eventId: envelope.eventId,
    messageId,
  };
}

function getPubSub(): PubSub {
  if (pubsub) {
    return pubsub;
  }

  const credentialsPath = ensureCredentialConfig();
  pubsub = new PubSub({
    projectId: requiredEnv("GCP_PROJECT_ID"),
    keyFilename: credentialsPath,
  });
  return pubsub;
}

function ensureCredentialConfig(): string | undefined {
  const credentialsJson = process.env.GOOGLE_EXTERNAL_ACCOUNT_CREDENTIALS_JSON;
  if (!credentialsJson) {
    return undefined;
  }

  const path = "/tmp/google-wif-credentials.json";
  if (!existsSync(path)) {
    JSON.parse(credentialsJson);
    writeFileSync(path, credentialsJson, { encoding: "utf8", mode: 0o600 });
  }
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
  return path;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
