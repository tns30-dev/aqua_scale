---
name: iot-aws-bridge
description: Use when building the device-to-cloud ingress — AWS IoT Core (MQTT/TLS, X.509 device certificates, topic-scoped IoT policies, IoT Rules), the TypeScript Lambda bridge that normalizes telemetry and publishes to GCP Pub/Sub via Workload Identity Federation, and the Raspberry Pi/simulator publisher. Trigger on "IoT", "MQTT", "device certificate", "Lambda bridge", "simulator", "telemetry ingress", "Raspberry Pi".
---

# AWS IoT → GCP bridge (spec: `main/iot.md`; boundary rules: `main/network_security.md`)

The only AWS components in the system. Multi-cloud is deliberate (assessment value):
**Device (Pi/simulator) → MQTT/TLS → AWS IoT Core → IoT Rule → TS Lambda → WIF → GCP
Pub/Sub `iot.telemetry.received` → Ingestion Service.**

## MQTT topic plan (decided)

`aquashield/{projectId}/{deviceId}/telemetry | status | alerts | debug` — IoT policy scopes
each device certificate to **its own** topic namespace only (no wildcard publish).

## AWS side checklist

1. Thing type + test thing(s); X.509 cert/key pair per device; cert stored securely on
   device/simulator (never in repo).
2. IoT policy: `iot:Connect` (own clientId) + `iot:Publish` (own topics only).
3. IoT Rule: SELECT from `aquashield/+/+/telemetry` → Lambda; **error action + CloudWatch
   alarm** so bridge failures are visible (evidence item).
4. Optional Terraform module `modules/aws-iot` if time allows; else manual + screenshots.

## Lambda bridge (TypeScript)

- Parse IoT event; extract topic segments + payload + device metadata.
- Build the standard **event envelope** (see `pubsub-eventing`): add `eventId`,
  `schemaVersion`, `occurredAt`/`publishedAt`, `source: "aws-lambda-bridge"`,
  `correlationId`. **Preserve raw payload + HMAC/signature fields untouched** — Ingestion
  does the application-level integrity validation, not the bridge.
- Auth to GCP via **Workload Identity Federation** (AWS role → GCP SA) — no long-lived GCP
  keys. GCP SA has `roles/pubsub.publisher` on `iot.telemetry.received` ONLY.
- No public inbound endpoint on the Lambda. CloudWatch logs + failure alarm.

## Device payload contract

`deviceId` (req) · `seqNo` (req — idempotency/replay) · `measuredAt` (req) · `readings`
map (req) · `signature` (HMAC, if enabled) · `projectId`/`pondId` (optional at edge;
Sensor Service resolves via `ResolveDevicePort`).

## Simulator

Build a small publisher (reuse patterns from the monolith's simulator/`mqtt_adapter`) that
signs payloads with the device key and publishes realistic aquaculture parameter streams —
needed for every downstream demo. Keep certs/keys in a git-ignored local dir.

## Evidence set (→ tracker `data_and_messaging_tracker.md`)

MQTT publish accepted · IoT Rule fires · Lambda log shows normalized envelope · Pub/Sub
message visible · **unauthorized topic publish blocked by policy** · forced bridge failure
alarm. Security framing: device identity = X.509 (transport), HMAC = application integrity
(defense in depth) — keep both.
