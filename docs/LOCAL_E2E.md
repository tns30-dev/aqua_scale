# Local E2E — frontend ↔ microservices (all-Docker)

One command runs the WHOLE platform locally: 9 service containers + infra + a path-aware
nginx gateway (the local rehearsal of the cloud edge route table), seeded with demo data.

## Run it

```bash
./scripts/up.sh                       # gen dev keys (first run) + build + start everything
./scripts/seed-demo.sh                # project, ponds, device, 72h telemetry, alert
cd frontend && npm install && npm run dev
```

→ **http://localhost:5173**, login **`admin@aquashield.local` / `AdminBoot123!`**

Frontend env: `frontend/.env.local` (gitignored, overrides `.env`):

```
VITE_API_BASE_URL=
VITE_WS_BASE_URL=
DEV_PROXY_HTTP_TARGET=http://localhost:8080
DEV_PROXY_WS_TARGET=ws://localhost:8080
```

(Empty `VITE_*` = same-origin through the Vite proxy → no CORS anywhere.)

Control:

```bash
./scripts/down.sh                     # stop (add -v to wipe the database volume)
./scripts/up.sh --no-build            # fast restart
docker compose --profile app ps       # status
docker logs -f aq-ingestion           # any service's logs (aq-<name>)
./scripts/seed-demo.sh                # re-run anytime: adds fresh readings + an alert
```

## How it's wired

```
browser :5173 ── Vite dev proxy ──► aq-gateway :8080 (nginx, path-aware)
                                      ├── aq-identity   :8081   /api/auth, /api/users
                                      ├── aq-project    :8082   /api/projects, catalogues
                                      ├── aq-sensor     :8083   /api/iot-devices, sensor-types, {id}/sensors
                                      ├── aq-ingestion  :8084   (Pub/Sub consumer + gRPC reads :9095)
                                      ├── aq-notification :8087 /api/alerts
                                      ├── aq-realtime   :8088   /ws/token, /ws (upgrade)
                                      ├── aq-pond       :8089   /api/ponds, cycles, pond-comparison
                                      ├── aq-analytics  :8090   /api/projects/{id}/charts/
                                      └── aq-audit      :8092   /api/audit
infra: aq-postgres :5433 · aq-redis :6380 · aq-pubsub :8085 · aq-bigtable :8086
       aq-pubsub-init (one-shot topic/sub/DLQ bootstrap)
```

- Services talk to each other over the compose network (gRPC `service-name:909x`,
  Pub/Sub via the emulator) — same shape as the GKE mesh, minus mTLS.
- The 9 services live under the compose **`app` profile**, so plain
  `docker compose up -d` stays infra-only (what `mvn verify` / vitest expect).
- JWT dev keys: `scripts/gen-dev-keys.sh` (gitignored under `local/dev-keys/`);
  `up.sh` exports them — multi-line PEMs can't live in compose's `.env`.

## Gateway route table (the cloud-gateway rehearsal)

`local/gateway/nginx.conf`. The REGEX exceptions are REQUIRED — prefix routing alone
misroutes all four:

| Route | Service |
|---|---|
| `~ ^/api/projects/{id}/charts/` | analytics |
| `~ ^/api/projects/{id}/pond-comparison` | pond |
| `~ ^/api/projects/{id}/ponds` | pond |
| `~ ^/api/projects/{id}/sensors` | sensor |
| `/api/auth`, `/api/users` | identity |
| `/api/profile-types`, `/api/parameter-types`, `/api/growth-indicators`, `/api/projects` | project |
| `/api/ponds`, `/api/cycles`, `/api/treatments`, `/api/pond-treatments` | pond |
| `/api/iot-devices`, `/api/sensor-types`, `/api/project-sensors` | sensor |
| `/api/alerts` | notification |
| `/api/audit` | audit |
| `/ws/token` + `/ws` (upgrade) | realtime |

## Verified working end-to-end (2026-06-04)

login/refresh → projects/catalogues → ponds → sensor admin → **charts** (8 keys, +08
hourly buckets) → **pond comparison** (real averages/series) → **energy dashboard**
(totalKwh/heatmap/alerts) → **alert** (seeded ph 9.2 breach) → **realtime**
(`/ws/token` mint → WS AUTH_OK → live `sensor.reading` frame on publish) — all through
the gateway.

## Known frontend gaps (no microservice owner yet — expect 404)

- `/api/feature-access`, `/api/action-controls` (user-management catalogues — identity)
- `/api/projects/{id}/summary/` (overview composition)
- `/api/ponds/{id}/historical/` (legacy endpoint; the charts page replaced it)

## Local quirks

- `seed-demo.sh` re-runs safely (existing project/device/mappings reused; telemetry
  seq_no derives from the clock so dedup never collides).
- Ingestion runs locally with `HMAC_MAX_SKEW=PT240H` so the seed can backfill 72h of
  SIGNED telemetry (cloud default stays PT5M).
- Chart config is seeded via SQL into `project.project_visualisations` — same as the
  monolith's approach (migrations); a project without rows gets `{}` charts (parity).
- Analytics caches chart config for 60s — charts may lag the seed by up to a minute.
- Dockerfiles use BuildKit cache mounts (`/root/.m2`, `/root/.npm`) — the first build
  downloads the world once; rebuilds are quick.
- Host-process alternative (faster JVM dev loop): `scripts/run-services.sh` — but the
  gateway routes to CONTAINERS; for host mode point `local/gateway/nginx.conf` upstreams
  back to `host.docker.internal:<port>`.
- Admin login 401 on an old postgres volume: the bootstrap admin only seeds an EMPTY
  users table — `./scripts/down.sh -v && ./scripts/up.sh` for a fresh start.
