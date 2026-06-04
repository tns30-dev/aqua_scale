# AquaMonitoring Pi Background Context

Last updated: 2026-06-03

Source repo:

- `/Users/thetnaungsoe/Desktop/AQ_Cook/AquaMonitoring-Pi`

Purpose of this file:

- Capture the current Raspberry Pi / edge-device implementation context.
- Explain how it supports the AquaShield v2 architecture story.
- Identify what can be reused, what should be improved, and how it maps to the future cloud-native microservices design.

This is background context only. It is not yet the final architecture decision document.

## High-Level Understanding

`AquaMonitoring-Pi` is the pond-side edge component for AquaShield.

It is responsible for:

- reading water-quality sensor data from hardware,
- preparing telemetry payloads,
- signing payloads,
- publishing telemetry to an MQTT broker,
- storing local readings on the Pi when running in offline/local mode,
- simulating sensor data for testing and demos,
- sending battery alerts through email and WhatsApp.

In the wider AquaShield architecture, this repo represents the edge layer:

```text
Water-quality sensors
  -> Raspberry Pi / edge gateway
  -> MQTT telemetry
  -> cloud ingestion
  -> persistence
  -> alerting
  -> dashboard
```

This matters because the teacher mentioned edge computing when discussing sensors. This repo gives concrete evidence that the project already has an edge-device concern, not only a web application concern.

## Edge Computing Interpretation

For AquaShield, edge computing means that the Raspberry Pi performs useful work near the pond before the data reaches the cloud.

Current edge responsibilities already visible in the repo:

- read sensor values over Modbus serial,
- detect missing or unsupported sensors,
- handle partial sensor failure,
- timestamp measurements,
- attach a sequence number,
- sign telemetry payloads with HMAC,
- publish over TLS MQTT,
- queue failed MQTT payloads for retry,
- support local SQLite storage without internet,
- generate simulated telemetry for testing,
- trigger local battery alerts.

Strong report wording:

> AquaShield includes an edge computing layer running on a Raspberry Pi gateway. The edge layer collects water-quality telemetry from pond sensors, performs lightweight validation and reliability handling, signs the payload, buffers data locally when required, and forwards telemetry to the cloud ingestion pipeline through MQTT.

## Current Repo Shape

Main files:

| File | Role |
|---|---|
| `publisher.py` | Reads sensor batches, builds signed telemetry payloads, publishes to MQTT, retries queued payloads. |
| `sensor_reader.py` | Reads real Hydrolab DS5X sensor values over Modbus serial. |
| `local_storage.py` | Stores readings locally in SQLite on the Pi. |
| `run_local.py` | Runs local-only sensor logging mode with no MQTT/cloud dependency. |
| `run_publisher.py` | Simple continuous loop around `publisher.py`. |
| `run_simulator.py` | Runs publishing loop using simulated sensor data instead of hardware. |
| `simulated_sensor_reader.py` | Drop-in replacement for `sensor_reader.py` that generates realistic test readings. |
| `battery_alert.py` | Sends low-battery alerts through Gmail SMTP and WhatsApp CallMeBot. |
| `ds5x_scan_registers.py` | Utility script to scan Modbus registers and inspect possible sensor values. |
| `modbus_test.py` | Small Modbus test script focused on pH reading. |
| `config/sensors.json` | Sensor/port configuration. |
| `config/sensor_json_example.json` | Example sensor configuration. |

There is no obvious `README.md`, `requirements.txt`, `pyproject.toml`, or Dockerfile in this repo at the moment.

Important inferred Python dependencies:

- `pymodbus`
- `paho-mqtt`
- `python-dotenv`

## Runtime Modes

### 1. Online MQTT Publisher Mode

Entry points:

- `publisher.py`
- `run_publisher.py`

Main behavior:

1. Load `.env` configuration.
2. Read sensor data from `sensor_reader.get_sensor_batches()`.
3. Build a telemetry payload.
4. Sign the payload using HMAC-SHA256.
5. Connect to MQTT with TLS.
6. Retry previously queued failed payloads.
7. Publish the current payload.
8. Save failed publish payloads to disk for later retry.

This is the mode that maps most directly to cloud ingestion.

### 2. Local Storage Mode

Entry point:

- `run_local.py`

Main behavior:

1. Read sensors at a configured interval.
2. Store readings into local SQLite.
3. Do not use MQTT.
4. Do not require Django/backend/cloud.
5. Provide quick stats and latest-reading checks.

This mode is useful for:

- offline operation,
- lab testing,
- field testing,
- fallback when network/cloud is unavailable,
- showing edge resilience.

### 3. Simulation Mode

Entry points:

- `run_simulator.py`
- `simulated_sensor_reader.py`

Main behavior:

1. Replace `sensor_reader` with `simulated_sensor_reader` at runtime.
2. Generate realistic readings based on profile type.
3. Publish simulated payloads through the normal publisher pipeline.
4. Allow cloud/dashboard testing without real hardware.

This is useful for:

- demo video,
- CI-style integration testing,
- cloud ingestion testing,
- frontend dashboard testing,
- alert testing.

Note:

- `run_simulator.py` exposes an `--inject-alerts` option.
- In the current observed code, the flag sets `simulated_sensor_reader.INJECT_ALERTS = True`, but the simulator file does not appear to use that variable. Treat this as a planned or incomplete feature unless confirmed later.

### 4. Hardware Utility Mode

Entry points:

- `modbus_test.py`
- `ds5x_scan_registers.py`

Main behavior:

- connect to a serial Modbus device,
- read Hydrolab DS5X registers,
- decode register values into floats,
- scan possible register addresses.

These are development/support utilities, not production runtime components.

## Sensor Hardware And Protocol

The production reader currently targets:

- sensor type: `hydrolab_ds5x`,
- protocol: Modbus serial,
- Python client: `pymodbus.client.ModbusSerialClient`,
- expected serial paths: `/dev/ttyUSB-RPB-1000-PORT-*`,
- baudrate: `19200`,
- parity: `E`,
- stopbits: `1`,
- bytesize: `8`.

Configured ports from `config/sensors.json`:

| Port | Sensor Type | Profile | Device Path |
|---|---|---|---|
| `RBP-1000-PORT-1` | `hydrolab_ds5x` | `shrimp` | `/dev/ttyUSB-RPB-1000-PORT-1` |
| `RBP-1000-PORT-2` | `hydrolab_ds5x` | `shrimp` | `/dev/ttyUSB-RPB-1000-PORT-2` |
| `RBP-1000-PORT-3` | `hydrolab_ds5x` | `fish` | `/dev/ttyUSB-RPB-1000-PORT-3` |
| `RBP-1000-PORT-4` | `hydrolab_ds5x` | `fish` | `/dev/ttyUSB-RPB-1000-PORT-4` |
| `RBP-1000-PORT-5` | `hydrolab_ds5x` | `crab_hatchery` | `/dev/ttyUSB-RPB-1000-PORT-5` |
| `RBP-1000-PORT-6` | `hydrolab_ds5x` | `crab_hatchery` | `/dev/ttyUSB-RPB-1000-PORT-6` |

Current real-reader parameters:

- temperature,
- pH,
- conductivity,
- dissolved oxygen,
- turbidity,
- chlorophyll.

The real reader also reads:

- salinity,
- battery voltage.

However, in the current code salinity and battery voltage are not included in the outgoing `readings` list. Battery voltage is used for battery alerting.

## Telemetry Payload Shape

`publisher.py` builds this payload shape:

```json
{
  "schema_version": "1.0",
  "device_code": "RBP-1000",
  "seq_no": 123,
  "measured_at": "2026-06-03T10:15:00Z",
  "sensor_batches": [
    {
      "port": "RBP-1000-PORT-1",
      "readings": [
        {
          "parameter": "temperature",
          "value": 28.5
        },
        {
          "parameter": "ph",
          "value": 7.8
        }
      ]
    }
  ],
  "sensor_errors": []
}
```

Before publishing, the payload is signed and extended:

```json
{
  "...": "...",
  "ts": 1717400000,
  "sig": "hmac_sha256_hex_signature"
}
```

The signing process:

1. Copy payload.
2. Add `ts` as current Unix timestamp.
3. Remove any existing `sig`.
4. Serialize canonical JSON with sorted keys.
5. HMAC-SHA256 with `DEVICE_KEY`.
6. Attach `sig`.

This aligns well with the current Django backend ingestion security model, which also validates signatures and sequence numbers.

## MQTT Publishing

Current MQTT configuration is loaded from `.env`:

- `MQTT_HOST`
- `MQTT_PORT`
- `MQTT_USERNAME`
- `MQTT_PASSWORD`
- `MQTT_CA_CERT`
- `MQTT_TOPIC_PREFIX`
- `DEVICE_CODE`
- `DEVICE_KEY`
- `QOS`
- `KEEPALIVE`

Topic shape:

```text
{MQTT_TOPIC_PREFIX}/{DEVICE_CODE}
```

Current MQTT security:

- username/password authentication,
- TLS with CA certificate,
- `tls_insecure_set(False)`,
- payload-level HMAC signature,
- sequence number for replay/idempotency support.

Target architecture interpretation:

- Current broker can be treated as the local/inherited baseline.
- Target cloud-native design should use AWS IoT Core for MQTT.
- AWS IoT Core would provide device certificates, IoT policies, and managed MQTT broker capability.
- The payload-level HMAC/sequence number should still be kept because it protects application-level integrity after the broker layer.

Target flow:

```text
Pi publisher
  -> AWS IoT Core MQTT
  -> AWS IoT Rule / bridge
  -> GCP Pub/Sub
  -> Java Ingestion Service
  -> Bigtable / PostgreSQL / BigQuery
```

## Reliability And Offline Behavior

Current reliability mechanisms:

- MQTT QoS defaults to `1`.
- `seq_no` is persisted in `~/aquamonitoring-pi/data/seq_no.txt`.
- failed publish payloads are stored under `~/aquamonitoring-pi/data/failed_queue`.
- queued payloads are retried before publishing the current payload.
- corrupt queue files are skipped and removed.
- partial sensor failures do not block publishing if at least one sensor batch succeeds.
- local SQLite mode can store readings without internet or MQTT.

Important nuance:

- If MQTT connection fails before building the current payload, `publisher.py` returns early and does not read/queue the current sensor sample.
- If publishing fails after the current payload is built, the payload is queued for retry.
- For stronger edge reliability, future refinement should decide whether the publisher should always read and locally persist data before attempting cloud publish.

Recommended future edge reliability model:

```text
Read sensors
  -> write local durable event/readings first
  -> attempt MQTT publish
  -> mark as synced only after broker ACK
  -> retry unsynced records
```

This would make the Pi more robust under unstable connectivity.

## Local SQLite Storage

`local_storage.py` creates a SQLite database at:

```text
~/aquamonitoring-pi/data/sensor_readings.db
```

Table:

```text
sensor_readings
```

Columns include:

- `id`,
- `device_code`,
- `port`,
- `measured_at`,
- core parameters,
- nitrogen-cycle parameters,
- alkalinity/hardness parameters,
- toxin parameters,
- microbiology parameters,
- lab parameter,
- `created_at`.

Supported parameter columns:

- temperature,
- salinity,
- ph,
- dissolved_oxygen,
- water_level,
- turbidity,
- conductivity,
- chlorophyll,
- ammonia,
- nitrite,
- nitrate,
- ammonium,
- tan,
- alkalinity,
- carbonate,
- bicarbonate,
- calcium,
- magnesium,
- total_hardness,
- phosphate,
- hydrogen_sulfide,
- total_vibrio_count,
- total_bacteria_count,
- ph_lab.

Index:

```sql
CREATE INDEX IF NOT EXISTS ix_sensor_readings_device_measured
ON sensor_readings (device_code, measured_at DESC);
```

Architectural interpretation:

- SQLite is the edge-local persistence layer.
- PostgreSQL/Bigtable/BigQuery are cloud persistence layers.
- This supports the polyglot persistence story at the edge and cloud levels.

Polyglot persistence mapping:

| Layer | Store | Purpose |
|---|---|---|
| Edge | SQLite | local offline readings, temporary durability, field diagnostics |
| Cloud operational domain | PostgreSQL / Cloud SQL | users, projects, ponds, cycles, thresholds, sensor registry, alert state |
| Cloud telemetry serving | Bigtable | raw/high-volume sensor telemetry and recent time-series access |
| Cloud analytics | BigQuery | historical analytics, reports, ML features |
| Runtime cache/state | Redis / Memorystore | cache, rate limit, realtime state |

## Battery Alerting

`battery_alert.py` provides low-battery alerting.

Supported channels:

- email through Gmail SMTP,
- WhatsApp through CallMeBot.

Configuration:

- `CHECK_BATTERY_THRESHOLD`,
- `BATTERY_WARNING_V`,
- `BATTERY_CRITICAL_V`,
- `ALERT_INTERVAL_HOURS`,
- `EMAIL_SENDER`,
- `EMAIL_PASSWORD`,
- `EMAIL_RECIPIENTS`,
- `WHATSAPP_NUMBERS`,
- `WHATSAPP_API_KEYS`.

Default threshold behavior:

- warning below `11.5V`,
- critical below `10.0V`,
- alert repeat interval defaults to 4 hours.

State file:

```text
~/aquamonitoring-pi/data/battery_alert_state.json
```

Architecture interpretation:

- Battery alerting is currently local/edge notification logic.
- In the target microservices architecture, critical battery events should become telemetry or alert events and flow through the cloud Alert/Notification Service.
- Local alerting can still remain as a safety fallback.

Better target model:

```text
Battery voltage low at edge
  -> local immediate alert if configured
  -> publish battery telemetry/event
  -> cloud Alert Service records and notifies centrally
```

## Simulation Support

The simulator supports realistic readings by profile:

- shrimp,
- fish,
- crab hatchery,
- treatment.

Simulated parameters include:

- pH,
- temperature,
- salinity,
- dissolved oxygen,
- ammonia,
- total bacteria count,
- ammonium,
- turbidity.

The simulator is useful for:

- demoing without physical sensor hardware,
- generating controlled data for the dashboard,
- testing MQTT ingestion,
- testing alert workflows,
- testing analytics data volume,
- producing repeatable project evidence.

Gap:

- Simulated parameters do not exactly match the real-reader output.
- The real reader publishes conductivity and chlorophyll, while the simulator includes ammonia, bacteria count, ammonium, and salinity.
- This is not necessarily wrong, but the target schema should normalize both hardware and simulated payloads consistently.

## Security Observations

Current strengths:

- MQTT over TLS.
- CA certificate configured.
- Payload HMAC-SHA256.
- Sequence number.
- Timestamp included in signed payload.
- Failed payloads persisted instead of silently discarded after publish failure.
- Device-specific `DEVICE_CODE` and `DEVICE_KEY`.

Current limitations / future hardening:

- `.env` secret management is local/manual.
- No hardware-backed key storage is visible.
- No certificate-based AWS IoT identity yet.
- Local queued payload files are plain JSON.
- Local SQLite database is not encrypted.
- No explicit secure update mechanism for Pi code.
- No formal edge device provisioning workflow yet.
- No SBOM/container/systemd hardening evidence yet.

Target security improvements:

- AWS IoT Core X.509 device certificates.
- Per-device IoT policies.
- Rotateable device credentials.
- Keep HMAC for application-level payload integrity.
- Optional encrypted local storage or file permissions hardening.
- Systemd service running as least-privilege user.
- Signed deployment package or controlled update mechanism.
- Device onboarding/offboarding process.
- Edge observability logs forwarded to cloud.

## Target AWS Edge Mapping

This repo can be mapped into AWS IoT edge concepts.

Current:

```text
Python process on Raspberry Pi
  -> reads Modbus sensors
  -> signs JSON telemetry
  -> publishes MQTT
```

Target with AWS IoT Core:

```text
Python edge publisher
  -> AWS IoT Core MQTT endpoint
  -> AWS IoT Rule
  -> GCP ingestion bridge / Pub/Sub
```

Target with AWS IoT Greengrass V2:

```text
Raspberry Pi running Greengrass Core
  -> local component wraps sensor reader/publisher
  -> local buffering / component lifecycle / deployment management
  -> AWS IoT Core
  -> GCP ingestion pipeline
```

Why Greengrass is useful:

- standard AWS edge runtime,
- local component deployment,
- local processing,
- local MQTT/client device support,
- cloud-managed edge fleet operations,
- better story for edge computing than a raw Python script alone.

Pragmatic project stance:

- For implementation speed, keep the current Python Pi code as the edge runtime.
- For architecture/report, position AWS IoT Greengrass V2 as the target edge management layer.
- Do not claim Greengrass is implemented unless it is actually configured and evidenced.

## Mapping To Future AquaShield Microservices

| Pi Concern | Future Service / Cloud Component |
|---|---|
| `DEVICE_CODE`, device identity | Sensor Registry Service |
| MQTT broker | AWS IoT Core |
| `sensor_batches` payload | Ingestion Service input contract |
| HMAC/signature validation | Java Ingestion Service |
| `seq_no` replay/idempotency | Java Ingestion Service / Bigtable raw message model |
| failed queue | edge offline durability / Greengrass spooler concept |
| local SQLite | edge-local persistence |
| battery alerts | Alert/Notification Service plus local safety alert |
| simulator | test harness / demo data generator |
| Modbus register reading | edge adapter / protocol adapter |
| sensor config JSON | Sensor Registry projection or edge config bundle |

## Suggested Cloud-Native Target Flow

```text
Hydrolab DS5X sensor
  -> Raspberry Pi serial/Modbus adapter
  -> edge validation and payload signing
  -> AWS IoT Core MQTT
  -> AWS IoT Rule
  -> GCP ingestion bridge
  -> Google Pub/Sub topic: iot.telemetry.received
  -> Java Ingestion Service
  -> Bigtable raw sensor message
  -> operational parsed reading store
  -> Pub/Sub event: reading.ingested
  -> Alert Service / Analytics Service / Realtime Bridge
```

## Suggested Event Types From Pi Context

Possible event names:

- `iot.telemetry.received`,
- `sensor.message.accepted`,
- `sensor.message.rejected`,
- `sensor.port.failed`,
- `reading.ingested`,
- `edge.battery.warning`,
- `edge.battery.critical`,
- `edge.device.offline`,
- `edge.device.recovered`,
- `edge.payload.queued`,
- `edge.payload.retried`.

## Suggested Payload Contract Refinement

The current payload is good enough as a baseline, but for microservices it should become more explicit.

Recommended future fields:

```json
{
  "schema_version": "1.1",
  "message_id": "uuid-or-device-seq",
  "device_code": "RBP-1000",
  "seq_no": 123,
  "measured_at": "2026-06-03T10:15:00Z",
  "published_at": "2026-06-03T10:15:03Z",
  "edge_runtime": {
    "type": "raspberry_pi",
    "software_version": "x.y.z"
  },
  "sensor_batches": [
    {
      "port": "RBP-1000-PORT-1",
      "sensor_type": "hydrolab_ds5x",
      "readings": [
        {
          "parameter": "ph",
          "value": 7.8,
          "unit": "pH",
          "quality": "valid"
        }
      ]
    }
  ],
  "sensor_errors": [],
  "ts": 1717400000,
  "sig": "..."
}
```

Recommended additions:

- `message_id`,
- `published_at`,
- `software_version`,
- `sensor_type` per batch,
- `unit` per reading,
- `quality` per reading,
- explicit `battery_voltage` either as normal telemetry or edge status.

## Implementation Gaps To Track

These are useful for refinement, not criticism.

1. No dependency manifest is visible.
   - Add `requirements.txt` or `pyproject.toml`.

2. No README is visible.
   - Add setup, `.env`, run modes, wiring, and troubleshooting instructions.

3. Online publisher does not queue current readings if MQTT connection fails before reading.
   - Consider local-first persistence before publish.

4. Simulator alert injection appears incomplete.
   - `--inject-alerts` sets a flag, but observed simulator code does not consume it.

5. Real and simulated parameter sets differ.
   - Normalize payload schema and document expected parameter catalogue.

6. DS5X float decoding should be verified.
   - `sensor_reader.py` and utility scripts appear to differ in word ordering.

7. Local secrets are `.env` based.
   - Good for prototype, but target needs device provisioning and key/cert management.

8. Local storage is not currently a sync queue.
   - It stores readings permanently for manual cleanup, not a cloud sync state machine.

9. No Greengrass configuration is currently visible.
   - Keep Greengrass as target architecture until implemented.

10. No systemd/service deployment evidence is visible.
    - For a real Pi deployment, add systemd unit files and logs.

## How To Use This In The Architecture Story

This repo strengthens the architecture narrative in several ways:

- AquaShield is not only a web dashboard.
- The system has real IoT/edge concerns.
- Sensor telemetry has a device-side lifecycle before reaching the cloud.
- Reliability requires buffering, retry, local fallback, and idempotency.
- Security starts at the edge through TLS, HMAC, device identity, and sequence numbers.
- Polyglot persistence includes edge SQLite plus cloud PostgreSQL, Bigtable, BigQuery, and Redis.
- AWS IoT Core and Greengrass are natural target services for the edge/MQTT side.
- GCP remains natural for GKE, Pub/Sub, Bigtable, BigQuery, Cloud SQL, and application services.

Strong report framing:

> The AquaMonitoring-Pi repository provides the edge implementation for AquaShield. It demonstrates how pond-side sensor telemetry is collected, signed, buffered, and transmitted from Raspberry Pi devices. This edge component becomes the source of the event-driven ingestion pipeline in the target cloud-native architecture, where AWS IoT Core handles managed MQTT/device connectivity and GCP services handle eventing, persistence, analytics, alerting, and dashboard delivery.

## What Not To Claim Yet

Do not claim these until implemented and evidenced:

- AWS IoT Core is already connected to this Pi repo.
- AWS IoT Greengrass is already installed/configured.
- The Pi is already managed as a cloud edge fleet.
- Local SQLite automatically syncs all offline readings to the cloud.
- Battery alerts already flow through the cloud Alert Service.
- Simulated alert injection is fully working.
- Device certificates replace username/password MQTT.

Safe claims:

- The project has a Raspberry Pi edge publisher repo.
- The repo reads Hydrolab DS5X sensors over Modbus.
- The repo builds telemetry payloads.
- The repo signs payloads with HMAC.
- The repo publishes to MQTT over TLS.
- The repo supports local SQLite storage mode.
- The repo supports simulated sensor data.
- The repo has battery alerting logic.
- The target architecture can evolve this into AWS IoT Core / Greengrass based edge computing.
