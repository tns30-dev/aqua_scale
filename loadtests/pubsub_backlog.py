"""
B2/A11 ingestion stress for the microservice target.

Publishes signed `iot.telemetry.received` envelopes to the Pub/Sub emulator.
This replaces the monolith MQTT adapter path with the target architecture:
Pub/Sub -> ingestion-service -> notification/realtime/audit subscribers.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import random
import time
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from typing import Iterable

RANGES = {
    "temperature": (26.0, 32.0),
    "salinity": (18.0, 35.0),
    "ph": (6.5, 8.8),
    "dissolved_oxygen": (4.0, 9.5),
    "ammonia": (0.0, 0.25),
    "ammonium": (0.0, 5.5),
    "nitrite": (0.0, 0.45),
    "nitrate": (0.0, 90.0),
    "alkalinity": (80.0, 170.0),
    "turbidity": (8.0, 45.0),
    "electricity": (0.2, 1.2),
}


def sign(payload: dict, device_key: str) -> str:
    body = {key: value for key, value in payload.items() if key != "sig"}
    canonical = json.dumps(body, separators=(",", ":"), sort_keys=True)
    return hmac.new(device_key.encode(), canonical.encode(), hashlib.sha256).hexdigest()


def reading(parameter: str) -> dict:
    lo, hi = RANGES[parameter]
    return {"parameter": parameter, "value": round(random.uniform(lo, hi), 3)}


def build_payload(args: argparse.Namespace, seq_no: int, measured_at: datetime) -> dict:
    parameters = args.parameters.split(",")
    payload = {
        "device_code": args.device_code,
        "seq_no": seq_no,
        "measured_at": measured_at.isoformat().replace("+00:00", "Z"),
        "ts": int(measured_at.timestamp()),
        "sensor_batches": [
            {"port": port, "readings": [reading(p) for p in parameters]}
            for port in args.ports.split(",")
        ],
    }
    payload["sig"] = sign(payload, args.device_key)
    return payload


def envelope(payload: dict) -> dict:
    return {
        "eventId": str(uuid.uuid4()),
        "eventType": "iot.telemetry.received",
        "schemaVersion": "v1",
        "correlationId": str(uuid.uuid4()),
        "payload": payload,
    }


def require_http_url(target: str) -> str:
    parsed = urllib.parse.urlparse(target)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"Refusing non-HTTP Pub/Sub emulator URL: {target}")
    return target


def publish_batch(url: str, messages: Iterable[dict]) -> None:
    body = json.dumps({
        "messages": [
            {"data": base64.b64encode(json.dumps(message).encode()).decode()}
            for message in messages
        ]
    }).encode()
    request = urllib.request.Request(
        require_http_url(url),
        data=body,
        headers={"Content-Type": "application/json"},
    )
    urllib.request.urlopen(request, timeout=30).read()  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected


def count_rows(dsn: str, device_code: str, start_seq: int, end_seq: int) -> int:
    import psycopg

    with psycopg.connect(dsn) as conn:
      with conn.cursor() as cur:
        cur.execute(
            """
            SELECT count(*)
            FROM ingestion.sensor_readings r
            JOIN ingestion.sensor_messages m ON m.sensor_message_id = r.sensor_message_id
            WHERE m.device_code = %s
              AND m.seq_no >= %s
              AND m.seq_no < %s
            """,
            (device_code, start_seq, end_seq),
        )
        return int(cur.fetchone()[0])


def watch_drain(args: argparse.Namespace, start_seq: int, end_seq: int, expected: int) -> None:
    if not args.watch_dsn:
        return
    print(f"\nwaiting for ingestion rows: {expected:,} expected")
    started = time.perf_counter()
    last_count = -1
    last_change = started
    while True:
        time.sleep(1)
        now = time.perf_counter()
        current = count_rows(args.watch_dsn, args.device_code, start_seq, end_seq)
        if current != last_count:
            last_count = current
            last_change = now
        if int(now - started) % 5 == 0:
            rate = current / max(now - started, 1)
            print(f"  {now - started:>6.0f}s {current:>8,} rows {rate:>8,.0f} rows/sec")
        if current >= expected:
            break
        if now - last_change > args.idle_limit:
            print(f"  no new rows for {args.idle_limit}s; stopping")
            break
    elapsed = max(last_change - started, 0.001)
    print(f"\nrows stored: {last_count:,} of {expected:,}")
    print(f"drain rate : {last_count / elapsed:,.0f} rows/sec")


def run(args: argparse.Namespace) -> None:
    random.seed(args.seed)
    pubsub_url = require_http_url(args.pubsub_url.rstrip("/"))
    url = f"{pubsub_url}/v1/projects/{args.pubsub_project}/topics/{args.topic}:publish"
    start_seq = args.start_seq or int(time.time()) * 1000
    ports = args.ports.split(",")
    expected_rows = args.count * len(ports)

    print(f"pubsub : {url}")
    print(f"device : {args.device_code}")
    print(f"ports  : {len(ports)}")
    print(f"mode   : {args.mode}")

    if args.mode == "burst":
        oldest = datetime.now(timezone.utc) - timedelta(seconds=args.interval * args.count)
        pending: list[dict] = []
        started = time.perf_counter()
        for i in range(args.count):
            measured_at = oldest + timedelta(seconds=args.interval * i)
            pending.append(envelope(build_payload(args, start_seq + i, measured_at)))
            if len(pending) >= args.batch_size:
                publish_batch(url, pending)
                pending = []
            if (i + 1) % 1000 == 0:
                rate = (i + 1) / max(time.perf_counter() - started, 0.001)
                print(f"  published {i + 1:>7,} messages {rate:>8,.0f} msg/sec")
        if pending:
            publish_batch(url, pending)
        elapsed = time.perf_counter() - started
        print(f"published {args.count:,} messages = {expected_rows:,} rows in {elapsed:.1f}s")
        watch_drain(args, start_seq, start_seq + args.count, expected_rows)
    else:
        deadline = time.perf_counter() + args.minutes * 60
        sent = 0
        while time.perf_counter() < deadline:
            publish_batch(url, [envelope(build_payload(
                args, start_seq + sent, datetime.now(timezone.utc)))])
            sent += 1
            print(f"  sent {sent:,} messages = {sent * len(ports):,} rows")
            time.sleep(args.interval)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["burst", "steady"], default="burst")
    parser.add_argument("--pubsub-url", default="http://localhost:8085")
    parser.add_argument("--pubsub-project", default="aquashield-local")
    parser.add_argument("--topic", default="iot.telemetry.received")
    parser.add_argument("--device-code", default="DEV-BANGKA-DEMO")
    parser.add_argument("--device-key", default="bangka-demo-device-key")
    parser.add_argument("--ports", default="BKA-A,BKA-B,BKA-C,BKA-D,BKA-E")
    parser.add_argument(
        "--parameters",
        default="temperature,salinity,ph,dissolved_oxygen,ammonia,nitrite,electricity",
    )
    parser.add_argument("--count", type=int, default=36000)
    parser.add_argument("--minutes", type=int, default=10)
    parser.add_argument("--interval", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--start-seq", type=int)
    parser.add_argument("--seed", type=int, default=20260806)
    parser.add_argument("--watch-dsn", help="optional Postgres DSN for drain measurement")
    parser.add_argument("--idle-limit", type=int, default=30)
    run(parser.parse_args())


if __name__ == "__main__":
    main()
