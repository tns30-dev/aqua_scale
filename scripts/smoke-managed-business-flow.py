#!/usr/bin/env python3
"""Managed-runtime business-flow smoke test.

Runs against the deployed services through local port-forwards and publishes signed
telemetry into real Google Pub/Sub. The script intentionally uses only the Python
standard library so it can run from a clean workstation.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib import error, parse, request


SGT = timezone(timedelta(hours=8))


class SmokeError(RuntimeError):
    pass


@dataclass(frozen=True)
class Bases:
    identity: str
    project: str
    pond: str
    sensor: str
    notification: str
    analytics: str
    realtime: str
    audit: str


def env(name: str, default: str | None = None, required: bool = False) -> str:
    value = os.environ.get(name, default)
    if required and not value:
        raise SmokeError(f"{name} is required")
    return value or ""


def bases() -> Bases:
    return Bases(
        identity=env("IDENTITY_BASE", "http://127.0.0.1:18081"),
        project=env("PROJECT_BASE", "http://127.0.0.1:18082"),
        pond=env("POND_BASE", "http://127.0.0.1:18089"),
        sensor=env("SENSOR_BASE", "http://127.0.0.1:18083"),
        notification=env("NOTIFICATION_BASE", "http://127.0.0.1:18087"),
        analytics=env("ANALYTICS_BASE", "http://127.0.0.1:18090"),
        realtime=env("REALTIME_BASE", "http://127.0.0.1:18088"),
        audit=env("AUDIT_BASE", "http://127.0.0.1:18092"),
    )


def url(base: str, path: str, params: dict[str, str] | None = None) -> str:
    full = base.rstrip("/") + path
    if params:
        return full + "?" + parse.urlencode(params)
    return full


def http_json(
    base: str,
    method: str,
    path: str,
    *,
    token: str | None = None,
    body: Any = None,
    params: dict[str, str] | None = None,
    expected: tuple[int, ...] = (200,),
    timeout: int = 20,
) -> Any:
    data = None
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body, separators=(",", ":")).encode()
        headers["Content-Type"] = "application/json"

    req = request.Request(url(base, path, params), data=data, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            status = resp.status
            raw = resp.read().decode()
    except error.HTTPError as exc:
        status = exc.code
        raw = exc.read().decode()
    except error.URLError as exc:
        raise SmokeError(f"{method} {path} failed to connect: {exc}") from exc

    parsed: Any
    if raw:
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = raw
    else:
        parsed = None
    if status not in expected:
        raise SmokeError(f"{method} {path} returned {status}: {parsed}")
    return parsed


def print_step(message: str) -> None:
    print(f">> {message}", flush=True)


def canonical_signature(payload: dict[str, Any], device_key: str) -> str:
    unsigned = {key: value for key, value in payload.items() if key != "sig"}
    canonical = json.dumps(unsigned, separators=(",", ":"), sort_keys=True)
    return hmac.new(device_key.encode(), canonical.encode(), hashlib.sha256).hexdigest()


def publish_pubsub(project_id: str, topic: str, access_token: str, envelopes: list[dict[str, Any]]) -> None:
    messages = [
        {"data": base64.b64encode(json.dumps(e, separators=(",", ":")).encode()).decode()}
        for e in envelopes
    ]
    endpoint = f"https://pubsub.googleapis.com/v1/projects/{project_id}/topics/{topic}:publish"
    req = request.Request(
        endpoint,
        data=json.dumps({"messages": messages}, separators=(",", ":")).encode(),
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=30) as resp:
            if resp.status != 200:
                raise SmokeError(f"Pub/Sub publish returned {resp.status}")
            json.loads(resp.read().decode())
    except error.HTTPError as exc:
        raw = exc.read().decode()
        raise SmokeError(f"Pub/Sub publish returned {exc.code}: {raw}") from exc
    except error.URLError as exc:
        raise SmokeError(f"Pub/Sub publish failed: {exc}") from exc


def wait_for(label: str, attempts: int, delay_seconds: float, probe):
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            value = probe()
            if value:
                return value
        except Exception as exc:  # retries are for eventual consistency
            last_error = exc
        time.sleep(delay_seconds)
    if last_error:
        raise SmokeError(f"{label} did not become ready: {last_error}") from last_error
    raise SmokeError(f"{label} did not become ready")


def first_by(items: list[dict[str, Any]], key: str, value: str) -> dict[str, Any]:
    for item in items:
        if item.get(key) == value:
            return item
    raise SmokeError(f"Missing {key}={value}")


def run() -> dict[str, Any]:
    b = bases()
    admin_email = env("SMOKE_ADMIN_EMAIL", "admin@aquashield.local")
    admin_password = env("SMOKE_ADMIN_PASSWORD", "AdminBoot123!", required=True)
    pubsub_project = env("PUBSUB_PROJECT_ID", required=True)
    pubsub_topic = env("PUBSUB_TOPIC", "iot.telemetry.received")
    access_token = env("GCP_ACCESS_TOKEN", required=True)

    suffix = datetime.now(SGT).strftime("%Y%m%d-%H%M%S")
    project_name = f"Managed Smoke Farm {suffix}"
    device_code = f"DEV-CLOUD-SMOKE-{suffix}"
    device_key = secrets.token_urlsafe(32)

    print_step("identity login and audit emission")
    login = http_json(
        b.identity,
        "POST",
        "/api/auth/login",
        body={"email": admin_email, "password": admin_password},
    )
    token = login["token"]
    refresh = login["refreshToken"]
    admin_id = login["user"]["userId"]

    print_step("project catalogue and farm creation")
    profiles = http_json(b.project, "GET", "/api/profile-types", token=token)
    profile = first_by(profiles, "code", "shrimp")
    created_project = http_json(
        b.project,
        "POST",
        "/api/projects",
        token=token,
        body={
            "name": project_name,
            "description": "Managed runtime business-flow smoke",
            "profileTypeId": profile["profile_type_id"],
        },
        expected=(201,),
    )
    project_id = created_project["project_id"]

    access = http_json(b.identity, "GET", f"/api/users/{admin_id}/access", token=token)
    project_ids = sorted(set(access.get("projectIds") or []) | {project_id})
    http_json(
        b.identity,
        "PUT",
        f"/api/users/{admin_id}/access",
        token=token,
        body={"projectIds": project_ids},
    )
    refreshed = http_json(
        b.identity,
        "POST",
        "/api/auth/refresh",
        body={"refreshToken": refresh},
    )
    token = refreshed["token"]

    print_step("pond setup")
    pond_a = http_json(
        b.pond,
        "POST",
        f"/api/projects/{project_id}/ponds",
        token=token,
        body={"name": "Pond Alpha", "description": "Smoke pond A"},
        expected=(201,),
    )
    pond_b = http_json(
        b.pond,
        "POST",
        f"/api/projects/{project_id}/ponds",
        token=token,
        body={"name": "Pond Beta", "description": "Smoke pond B"},
        expected=(201,),
    )
    pond_a_id = pond_a["pond_id"]
    pond_b_id = pond_b["pond_id"]

    print_step("sensor type, device, and port mappings")
    params = http_json(b.project, "GET", "/api/parameter-types", token=token)
    wanted_codes = {
        "temperature",
        "ph",
        "dissolved_oxygen",
        "ammonium",
        "turbidity",
        "electricity",
    }
    parameter_ids = [
        p["parameter_id"] for p in params if p.get("parameter_code") in wanted_codes
    ]
    if len(parameter_ids) != len(wanted_codes):
        raise SmokeError("Parameter catalogue is missing expected telemetry parameters")
    sensor_type = http_json(
        b.sensor,
        "POST",
        "/api/sensor-types",
        token=token,
        body={
            "name": f"Managed Smoke Multiprobe {suffix}",
            "model_number": "MSM-1",
            "parameter_ids": parameter_ids,
            "manufacturer": "AquaShield",
        },
        expected=(201,),
    )
    http_json(
        b.sensor,
        "POST",
        "/api/iot-devices",
        token=token,
        body={
            "device_code": device_code,
            "device_name": f"Managed Smoke Gateway {suffix}",
            "device_key": device_key,
        },
        expected=(201,),
    )
    http_json(
        b.sensor,
        "POST",
        f"/api/projects/{project_id}/sensors",
        token=token,
        body={
            "pond_id": pond_a_id,
            "sensor_type_id": sensor_type["sensor_type_id"],
            "device_code": device_code,
            "port": "A1",
            "serial_number": f"MS-A-{suffix}",
        },
        expected=(201,),
    )
    http_json(
        b.sensor,
        "POST",
        f"/api/projects/{project_id}/sensors",
        token=token,
        body={
            "pond_id": pond_b_id,
            "sensor_type_id": sensor_type["sensor_type_id"],
            "device_code": device_code,
            "port": "A2",
            "serial_number": f"MS-B-{suffix}",
        },
        expected=(201,),
    )

    print_step("threshold and energy settings")
    http_json(
        b.project,
        "PUT",
        f"/api/projects/{project_id}/parameter-settings",
        token=token,
        body=[
            {
                "parameter_code": "ph",
                "min_threshold": 6.5,
                "max_threshold": 8.5,
                "is_key_parameter": True,
            }
        ],
    )
    http_json(
        b.project,
        "PUT",
        f"/api/projects/{project_id}/energy/settings",
        token=token,
        body={
            "tariffPerUnit": 0.25,
            "currency": "SGD",
            "highHourlyThreshold": 2.0,
        },
    )

    print_step("publish signed telemetry to real Pub/Sub")
    now = datetime.now(timezone.utc).replace(microsecond=0)
    ts = int(now.timestamp())
    seq = int(time.time() * 1000)

    def payload(seq_no: int, measured_at: datetime, batches: list[dict[str, Any]]) -> dict[str, Any]:
        body = {
            "device_code": device_code,
            "seq_no": seq_no,
            "measured_at": measured_at.isoformat().replace("+00:00", "Z"),
            "ts": int(measured_at.timestamp()),
            "sensor_batches": batches,
        }
        body["sig"] = canonical_signature(body, device_key)
        return body

    normal = payload(
        seq,
        now,
        [
            {
                "port": "A1",
                "readings": [
                    {"parameter": "temperature", "value": 27.8},
                    {"parameter": "ph", "value": 7.4},
                    {"parameter": "dissolved_oxygen", "value": 6.2},
                    {"parameter": "ammonium", "value": 0.22},
                    {"parameter": "turbidity", "value": 10.7},
                    {"parameter": "electricity", "value": 1.4},
                ],
            },
            {
                "port": "A2",
                "readings": [
                    {"parameter": "temperature", "value": 28.3},
                    {"parameter": "ph", "value": 7.8},
                    {"parameter": "dissolved_oxygen", "value": 5.9},
                    {"parameter": "ammonium", "value": 0.34},
                    {"parameter": "turbidity", "value": 13.1},
                    {"parameter": "electricity", "value": 1.7},
                ],
            },
        ],
    )
    breach = payload(
        seq + 1,
        now,
        [{"port": "A1", "readings": [{"parameter": "ph", "value": 9.2}]}],
    )
    correlation_id = str(uuid.uuid4())
    envelopes = [
        {
            "eventId": str(uuid.uuid4()),
            "eventType": "iot.telemetry.received",
            "schemaVersion": "v1",
            "occurredAt": now.isoformat().replace("+00:00", "Z"),
            "source": "managed-business-smoke",
            "correlationId": correlation_id,
            "payload": normal,
        },
        {
            "eventId": str(uuid.uuid4()),
            "eventType": "iot.telemetry.received",
            "schemaVersion": "v1",
            "occurredAt": now.isoformat().replace("+00:00", "Z"),
            "source": "managed-business-smoke",
            "correlationId": correlation_id,
            "payload": breach,
        },
    ]
    publish_pubsub(pubsub_project, pubsub_topic, access_token, envelopes)

    today = datetime.now(SGT).date().isoformat()

    print_step("wait for ingestion, downstream alert, and read models")

    def energy_ready() -> dict[str, Any] | None:
        body = http_json(
            b.project,
            "GET",
            f"/api/projects/{project_id}/energy/dashboard",
            token=token,
            params={"groupBy": "day", "startDate": today, "endDate": today},
        )
        total = float(body.get("kpis", {}).get("totalKwh") or 0)
        return body if total >= 3.1 else None

    energy = wait_for("energy dashboard", 24, 2.5, energy_ready)

    def alerts_ready() -> dict[str, Any] | None:
        body = http_json(
            b.notification,
            "GET",
            "/api/alerts",
            token=token,
            params={"projectId": project_id},
        )
        return body if len(body.get("alerts") or []) >= 1 else None

    alerts = wait_for("threshold alert", 24, 2.5, alerts_ready)

    comparison = http_json(
        b.pond,
        "GET",
        f"/api/projects/{project_id}/pond-comparison",
        token=token,
        params={
            "pondAId": pond_a_id,
            "pondBId": pond_b_id,
            "startDate": today,
            "endDate": today,
        },
    )
    metrics = comparison.get("metrics") or []
    if not metrics:
        raise SmokeError("Pond comparison returned no metrics")

    charts = http_json(
        b.analytics,
        "GET",
        f"/api/projects/{project_id}/charts/",
        token=token,
        params={"pondId": pond_a_id, "startDate": today, "endDate": today},
    )
    if not isinstance(charts, dict):
        raise SmokeError("Analytics charts did not return a JSON object")

    ws = http_json(b.realtime, "POST", "/ws/token", token=token)
    if not ws.get("token"):
        raise SmokeError("Realtime token mint returned no token")

    def audit_ready() -> list[dict[str, Any]] | None:
        rows = http_json(
            b.audit,
            "GET",
            "/api/audit/security",
            token=token,
            params={"outcome": "success", "limit": "10"},
        )
        for row in rows:
            if row.get("eventType") == "login.succeeded" and row.get("actorUserId") == admin_id:
                return rows
        return None

    audit_rows = wait_for("audit security event", 24, 2.5, audit_ready)

    summary = {
        "projectId": project_id,
        "projectName": project_name,
        "ponds": {"alpha": pond_a_id, "beta": pond_b_id},
        "deviceCode": device_code,
        "pubsubProject": pubsub_project,
        "pubsubTopic": pubsub_topic,
        "correlationId": correlation_id,
        "energyTotalKwh": energy["kpis"]["totalKwh"],
        "activeAlerts": len(alerts.get("alerts") or []),
        "comparisonMetricCount": len(metrics),
        "analyticsChartKeys": sorted(charts.keys()),
        "auditSecurityRows": len(audit_rows),
        "realtimeTokenMinted": True,
    }
    return summary


def main() -> int:
    try:
        summary = run()
    except SmokeError as exc:
        print(f"SMOKE FAILED: {exc}", file=sys.stderr)
        return 1

    print_step("managed business-flow smoke passed")
    print(json.dumps(summary, indent=2, sort_keys=True))
    summary_path = os.environ.get("SMOKE_SUMMARY_PATH")
    if summary_path:
        with open(summary_path, "w", encoding="utf-8") as fh:
            json.dump(summary, fh, indent=2, sort_keys=True)
            fh.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
