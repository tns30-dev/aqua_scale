# Test Cases

IDs such as `{projectId}`, `{pondId}`, `{cycleId}`, `{pondAId}`, and `{pondBId}`
are resolved during k6 setup from the authenticated Demo Shrimp Farm user.

| Test case | API endpoint / path covered | Concurrent users / load | Records / data window |
|---|---|---:|---|
| Busy-day load | `/api/csrf`, `/api/auth/login`, `/api/auth/me`, `/api/ponds`, `/api/cycles`, `/api/projects/{projectId}/summary`, `/api/ponds/latest-readings`, `/api/projects/{projectId}/charts/`, `/api/cycles/{cycleId}/details/`, `/api/projects/{projectId}/pond-comparison`, `/api/projects/{projectId}/energy/dashboard/`, `/api/projects/{projectId}/feeding/options/`, `/api/projects/{projectId}/feeding/dashboard/`, `/api/pond-treatments/`, `/api/pond-treatments/stability/`, `/api/alerts` | 50 concurrent users; 30 sec ramp up, 60 sec hold, 30 sec ramp down | 4,000,000+ Demo Shrimp Farm readings; 887,988 July readings |
| Growth probe: baseline data | `/api/projects/{projectId}/summary`, `/api/projects/{projectId}/charts/`, `/api/projects/{projectId}/pond-comparison`, `/api/projects/{projectId}/energy/dashboard/`, `/api/projects/{projectId}/feeding/options/`, `/api/projects/{projectId}/feeding/dashboard/` | 1 concurrent user, 3 iterations | 40,507 total local readings; 4,788 July readings |
| Growth probe: 1,000,000 readings | Same as growth baseline | 1 concurrent user, 20 iterations | 1,000,000 Demo Shrimp Farm readings; 446,388 July readings |
| Growth probe: 4,000,000 readings | Same as growth baseline | 1 concurrent user, 20 iterations | 4,000,000 Demo Shrimp Farm readings; 887,988 July readings |
| Endpoint herd: `summary` | `/api/projects/{projectId}/summary` | 50 concurrent users for 60 sec | 4,000,000+ Demo Shrimp Farm readings |
| Endpoint herd: `comparison` | `/api/projects/{projectId}/pond-comparison?pondAId={pondAId}&pondBId={pondBId}&startDate=2026-07-01&endDate=2026-07-31&grouping=auto` | 50 concurrent users for 60 sec | 887,988 July readings |
| Endpoint herd: `alerts` | `/api/alerts?projectId={projectId}` | 50 concurrent users for 60 sec | 825 local alert records |
| Endpoint herd: `energy` | `/api/projects/{projectId}/energy/dashboard/?startDate=2026-07-01&endDate=2026-07-31&groupBy=day` | 50 concurrent users for 60 sec | 887,988 July readings; 7,935 hourly energy rollup rows |
| Endpoint herd: `charts` | `/api/projects/{projectId}/charts/?pondId={pondId}&startDate=2026-07-01&endDate=2026-07-31&grouping=daily` | 50 concurrent users for 60 sec | 887,988 July readings |
| Pub/Sub backlog drain | Pub/Sub emulator topic `iot.telemetry.received`, then DB check on `ingestion.sensor_messages` and `ingestion.sensor_readings` | 200-message burst | `DEV-LOCAL-BACKLOG`; 2 mapped ports; 400 expected stored rows |
| WebSocket fanout | `POST /ws/token`, then `/ws` upgrade and first-frame auth message | 50 concurrent WebSocket sessions, 30 sec hold | Local realtime gateway |
| Mixed bad-day load | Busy-day HTTP + WebSocket fanout + Pub/Sub backlog drain together | 50 HTTP concurrent users, 50 WebSocket sessions, 200 Pub/Sub messages | 4,000,000+ readings plus 400 backlog rows |

| Target | Value |
|---|---:|
| Main response target | p95 under 3 sec |
| Busy-day users | 50 concurrent users |
| Endpoint herd users | 50 concurrent users per endpoint |
| WebSocket users | 50 concurrent WebSocket sessions |
| Sensor model | 50 ponds, one reading every 30 seconds |
| Main growth level | 4,000,000 readings minimum |
