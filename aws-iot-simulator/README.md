# AWS IoT Device Simulator (live-demo Raspberry Pi stand-in)

Software stand-in for the physical Raspberry Pi we don't have. It connects to
**real AWS IoT Core** over MQTT/TLS with the real device certificate and drives
the entire live cloud path end-to-end:

```
laptop (this simulator)
  │  MQTT/TLS + X.509 device cert
  ▼
AWS IoT Core  →  IoT Rule  →  Lambda bridge  →  (WIF)  →  GCP Pub/Sub
  →  Ingestion  →  Cloud SQL / Bigtable  →  frontend dashboard (live)
```

Only the sensor numbers are simulated; every cloud hop is real.

## Identity model (important)

Two layers, deliberately split:

| Layer | Value | Why |
|---|---|---|
| AWS transport (cert/Thing/topic) | `aq-dev-simulator-01` | The X.509 cert Terraform created. IoT policy scopes it to client-id `aq-dev-simulator-01` and topic `aquashield/dev/telemetry/aq-dev-simulator-01` ONLY. |
| Application (`device_code` in payload) | `RBP-1000` | The registered Pi device in the cloud DB (active, has HMAC `device_key`, 5 sensor ports mapped). Ingestion validates against this. |

This works because the Lambda bridge (`aws-iot-bridge/src/normalize.ts`) forwards
the **payload's** `device_code`, not the topic Thing-name. Verified.

## Device facts (from cloud Cloud SQL, project aquashield-ms-dev-20260808)

- Registered devices: `RBP-1000` (target — active, HMAC key set), `EM-CENTRAL-01`
  (no key). `aq-dev-simulator-01` is NOT registered, so we present as `RBP-1000`.
- RBP-1000 ports: `RBP-1000-PORT-1..5`, each a `hydrolab_ds5x` multi-parameter
  water-quality probe (profiles: shrimp/fish).
- Parameters per reading: temperature, ph, dissolved_oxygen, ammonia, nitrite,
  nitrate, ammonium, vibrio/bacteria counts, etc. (per `simulated_sensor_reader.py`).

## Credentials (all gitignored under repo-root `device-certs/`)

- Endpoint: `a2q2tffhcbxvwk-ats.iot.ap-southeast-1.amazonaws.com` (port 8883)
- `aq-dev-simulator-01.cert.pem`, `aq-dev-simulator-01.private.key`, `AmazonRootCA1.pem`
- RBP-1000 `device_key` (HMAC) — pulled at build time, kept out of git.

## Demo behavior

- **Steady stream:** publish realistic in-range readings for all 5 ports every
  ~10 s → dashboard shows live healthy telemetry.
- **One alert ~every 30 s:** on a 30 s timer, push exactly one parameter on one
  port past its safe threshold → notification service raises one alert →
  dashboard alerts panel updates live. Rotate which port/parameter breaches each
  cycle (and/or breach-then-recover) so each 30 s yields a genuinely NEW alert
  rather than a de-duplicated repeat.
- Flags: `--interval` (steady cadence), `--alert-every 30`, `--count`, `--dry-run`.

## Allowed parameters (RBP-1000 ports, from cloud catalogue)

Both ports are "Multi-Parameter Sensor" — only these 4 parameters are accepted
(anything else is rejected by ingestion):

| Parameter | Safe range (project "Demo Shrimp Farm") | Unit |
|---|---|---|
| dissolved_oxygen | 5 – 10 | mg/L |
| ph | 7 – 8.5 | — |
| salinity | 12 – 28 | ppt |
| temperature | 26 – 32 | °C |

Breach values are set outside these ranges so each injected reading trips a real
alert.

## Run it

```bash
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
# demo cadence: healthy readings every 10s, one rotating alert every 30s
./.venv/bin/python simulate.py --interval 10 --alert-every 30
# offline check (no AWS): ./.venv/bin/python simulate.py --dry-run --count 5
```

## Status — VALIDATED end-to-end (2026-08-09)

Full path proven against the live cloud environment:

```
laptop  --MQTT/TLS-->  AWS IoT Core (connect: Success)
        --IoT Rule-->  Lambda bridge (CloudWatch: deviceCode=RBP-1000, seqNo=...)
        --WIF-->       Pub/Sub iot.telemetry.received
        -->            Ingestion (HMAC verified, params validated, persisted)
        -->            Notification (threshold check)
        -->            alert_log rows, e.g.:
                         "salinity exceeded maximum: 45 > 28.0"   (critical)
                         "dissolved_oxygen below minimum: 1.2 < 5.0" (warning)
```

Two contract fixes were needed and are baked in:
1. **HMAC**: AWS IoT + the JS Lambda re-serialize the payload and drop `.0` from
   whole-number floats (`29.0`→`29`), breaking a Python signature over `29.0`.
   Fix: emit whole-number readings as ints so Python/JS/Java canonical bytes match.
2. **Parameters**: send only the 4 allowed parameters (above), not the full
   hydrolab set.

Every injected breach produced a matching alert with correct value + severity.
