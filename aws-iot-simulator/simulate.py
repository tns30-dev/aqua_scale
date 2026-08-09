#!/usr/bin/env python3
"""
AWS IoT device simulator — live-demo stand-in for the physical Raspberry Pi.

Connects to REAL AWS IoT Core over MQTT/TLS with the real X.509 device
certificate and publishes realistic aquaculture telemetry, driving the whole
cloud path: AWS IoT Core -> IoT Rule -> Lambda bridge -> GCP Pub/Sub ->
Ingestion -> Cloud SQL/Bigtable -> frontend dashboard.

Identity split (see README):
  * AWS transport : client-id + topic locked to Thing `aq-dev-simulator-01`
                    by the device IoT policy.
  * Application   : payload device_code = `RBP-1000` (the registered Pi in the
                    cloud DB) — the Lambda forwards the payload's device_code.

Demo behavior:
  * Steady realistic readings every --interval seconds (default 10) on the
    mapped ports, so the dashboard shows live healthy telemetry.
  * Every --alert-every seconds (default 30) exactly ONE parameter on ONE port
    is pushed past a safe threshold, ROTATING through a list so each cycle
    yields a genuinely new alert (dodges notification de-duplication).

Payload + HMAC signature match AquaMonitoring-Pi/publisher.py exactly so the
ingestion service accepts and validates the messages.
"""

import argparse
import hashlib
import hmac
import json
import os
import random
import ssl
import time

import paho.mqtt.client as mqtt

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CERT_DIR = os.path.normpath(os.path.join(HERE, "..", "device-certs"))

# --- Defaults (all overridable via CLI/env) --------------------------------
DEFAULTS = {
    "endpoint": "a2q2tffhcbxvwk-ats.iot.ap-southeast-1.amazonaws.com",
    "port": 8883,
    "client_id": "aq-dev-simulator-01",  # MUST match IoT policy (Thing name)
    "topic": "aquashield/dev/telemetry/aq-dev-simulator-01",
    "device_code": "RBP-1000",           # registered app-level device
    "ports": ["RBP-1000-PORT-1", "RBP-1000-PORT-2"],  # mapped in cloud DB
}

# Parameters allowed for RBP-1000's ports (sensor_type "Multi-Parameter Sensor",
# resolved from the cloud catalogue). Sending any other parameter is rejected by
# ingestion ("Parameter 'X' not allowed for device port").
PARAMS = ["dissolved_oxygen", "ph", "salinity", "temperature"]

# Healthy baselines for realistic in-range readings.
BASELINE = {
    "dissolved_oxygen": 6.0, "ph": 7.8, "salinity": 15.0, "temperature": 29.0,
}

# Rotating breach schedule: (port_index, parameter, value, human label).
# Extreme values that trip any reasonable aquaculture threshold. Rotating the
# (port, parameter) each cycle guarantees a distinct new alert every time.
BREACHES = [
    (0, "dissolved_oxygen", 1.2, "dissolved oxygen critically LOW"),
    (1, "ph", 9.8, "pH dangerously HIGH"),
    (0, "temperature", 38.5, "water temperature HIGH"),
    (1, "salinity", 45.0, "salinity HIGH"),
    (0, "ph", 5.2, "pH dangerously LOW"),
    (1, "dissolved_oxygen", 1.0, "dissolved oxygen critically LOW"),
    (0, "salinity", 2.0, "salinity LOW"),
    (1, "temperature", 39.0, "water temperature HIGH"),
]


def round_param(param, value):
    v = round(value, 2)
    # Collapse whole-number floats to int (15.0 -> 15). AWS IoT + the Lambda
    # re-serialize the payload as JavaScript, which drops the ".0"; signing the
    # int form keeps the Python/JS/Java canonical bytes identical so the HMAC
    # verifies in ingestion.
    if v == int(v):
        return int(v)
    return v


def normal_value(param):
    base = BASELINE[param]
    return round_param(param, base * (1.0 + random.uniform(-0.05, 0.05)))


def build_batches(ports, breach=None):
    """One reading batch per port. `breach` = (port_index, param, value)."""
    batches = []
    for idx, port in enumerate(ports):
        readings = []
        for param in PARAMS:
            if breach and breach[0] == idx and breach[1] == param:
                value = round_param(param, breach[2])
            else:
                value = normal_value(param)
            readings.append({"value": value, "parameter": param})
        batches.append({"port": port, "readings": readings})
    return batches


def sign_payload(payload, secret):
    """HMAC-SHA256 over canonical JSON — identical to publisher.py."""
    p = dict(payload)
    p["ts"] = int(time.time())
    p.pop("sig", None)
    canonical = json.dumps(p, separators=(",", ":"), sort_keys=True).encode("utf-8")
    p["sig"] = hmac.new(secret.encode("utf-8"), canonical, hashlib.sha256).hexdigest()
    return p


def build_payload(device_code, seq_no, batches):
    return {
        "schema_version": "1.0",
        "device_code": device_code,
        "seq_no": seq_no,
        "measured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sensor_batches": batches,
        "sensor_errors": [],
    }


def make_client(args):
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=args.client_id)
    client.tls_set(
        ca_certs=args.ca,
        certfile=args.cert,
        keyfile=args.key,
        tls_version=ssl.PROTOCOL_TLS_CLIENT,
    )
    connected = {"ok": False, "rc": None}

    def on_connect(c, u, flags, reason_code, props):
        connected["ok"] = (reason_code == 0 or getattr(reason_code, "is_failure", False) is False)
        connected["rc"] = reason_code
        print(f"[mqtt] connect: {reason_code}")

    client.on_connect = on_connect
    client.connect(args.endpoint, args.port, keepalive=60)
    client.loop_start()
    for _ in range(50):
        if connected["rc"] is not None:
            break
        time.sleep(0.1)
    if not connected["ok"]:
        raise SystemExit(f"[fatal] MQTT connect failed: {connected['rc']}")
    return client


def next_seq(last):
    # epoch-seconds base keeps seq above the imported counter values, and
    # strictly increasing across restarts and same-second calls.
    return max(last + 1, int(time.time()))


def main():
    ap = argparse.ArgumentParser(description="AWS IoT aquaculture telemetry simulator")
    ap.add_argument("--endpoint", default=os.getenv("IOT_ENDPOINT", DEFAULTS["endpoint"]))
    ap.add_argument("--port", type=int, default=int(os.getenv("IOT_PORT", DEFAULTS["port"])))
    ap.add_argument("--client-id", default=os.getenv("IOT_CLIENT_ID", DEFAULTS["client_id"]))
    ap.add_argument("--topic", default=os.getenv("IOT_TOPIC", DEFAULTS["topic"]))
    ap.add_argument("--device-code", default=os.getenv("DEVICE_CODE", DEFAULTS["device_code"]))
    ap.add_argument("--ports", default=os.getenv("PORTS", ",".join(DEFAULTS["ports"])),
                    help="comma-separated mapped ports")
    ap.add_argument("--cert-dir", default=os.getenv("CERT_DIR", DEFAULT_CERT_DIR))
    ap.add_argument("--cert", default=None)
    ap.add_argument("--key", default=None)
    ap.add_argument("--ca", default=None)
    ap.add_argument("--device-key-file", default=None)
    ap.add_argument("--interval", type=float, default=float(os.getenv("INTERVAL", "10")),
                    help="seconds between normal publishes")
    ap.add_argument("--alert-every", type=float, default=float(os.getenv("ALERT_EVERY", "30")),
                    help="seconds between injected threshold breaches")
    ap.add_argument("--count", type=int, default=int(os.getenv("COUNT", "0")),
                    help="stop after N publishes (0 = run forever)")
    ap.add_argument("--dry-run", action="store_true",
                    help="build+sign+print payloads without connecting to AWS")
    ap.add_argument("--qos", type=int, default=1)
    args = ap.parse_args()

    d = args.cert_dir
    args.cert = args.cert or os.path.join(d, "aq-dev-simulator-01.cert.pem")
    args.key = args.key or os.path.join(d, "aq-dev-simulator-01.private.key")
    args.ca = args.ca or os.path.join(d, "AmazonRootCA1.pem")
    args.device_key_file = args.device_key_file or os.path.join(d, "rbp-1000.device_key")
    ports = [p.strip() for p in args.ports.split(",") if p.strip()]

    with open(args.device_key_file, "r", encoding="utf-8") as f:
        device_key = f.read().strip()
    if not device_key:
        raise SystemExit("[fatal] empty device_key")

    print(f"[sim] device_code={args.device_code} ports={ports}")
    print(f"[sim] topic={args.topic} interval={args.interval}s alert_every={args.alert_every}s")
    print(f"[sim] mode={'DRY-RUN' if args.dry_run else 'AWS IoT Core ' + args.endpoint}")

    client = None if args.dry_run else make_client(args)

    seq = int(time.time())
    published = 0
    breach_idx = 0
    last_alert = 0.0
    try:
        while True:
            now = time.time()
            breach = None
            label = None
            if now - last_alert >= args.alert_every:
                pidx, param, value, label = BREACHES[breach_idx % len(BREACHES)]
                if pidx < len(ports):
                    breach = (pidx, param, value)
                    breach_idx += 1
                    last_alert = now

            batches = build_batches(ports, breach)
            seq = next_seq(seq)
            payload = sign_payload(build_payload(args.device_code, seq, batches), device_key)

            if breach:
                print(f"[ALERT] seq={seq} port={ports[breach[0]]} -> {label} "
                      f"({breach[1]}={breach[2]})")
            else:
                print(f"[ok]    seq={seq} {len(ports)} ports, healthy readings")

            if args.dry_run:
                print(json.dumps(payload)[:200] + " ...")
            else:
                info = client.publish(args.topic, json.dumps(payload), qos=args.qos)
                info.wait_for_publish(timeout=5)
                if not info.is_published():
                    print("[warn] PUBACK not confirmed")

            published += 1
            if args.count and published >= args.count:
                break
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n[sim] stopped")
    finally:
        if client:
            client.loop_stop()
            client.disconnect()
    print(f"[sim] published {published} messages")


if __name__ == "__main__":
    main()
