#!/usr/bin/env bash
# Seed a demo dataset THROUGH THE REAL APIs + signed telemetry, so the frontend has
# something to show: project, 2 ponds, device+mappings, thresholds, energy settings,
# 72h of backfilled readings (HMAC-signed; ingestion runs with HMAC_MAX_SKEW=PT240H
# locally), one threshold breach -> alert.
# Prereqs: compose up + pubsub-bootstrap + run-services.sh. Requires: curl, jq, python3.

set -euo pipefail
GW="${GW:-http://localhost:8080}"
PUBSUB="${PUBSUB:-http://localhost:8085}"
PUBSUB_PROJECT="${PUBSUB_PROJECT:-aquashield-local}"
DEVICE_CODE="DEV-LOCAL-1"
DEVICE_KEY="local-dev-device-key"

say() { printf '\n>> %s\n' "$*"; }

say "admin login"
LOGIN=$(curl -fsS -X POST "$GW/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@aquashield.local","password":"AdminBoot123!"}')
TOKEN=$(jq -r .token <<<"$LOGIN")
REFRESH=$(jq -r .refreshToken <<<"$LOGIN")
ADMIN_ID=$(jq -r .user.userId <<<"$LOGIN")
echo "   admin: $ADMIN_ID"
auth=(-H "Authorization: Bearer $TOKEN")

say "resolve shrimp profile + create project"
PROFILE_ID=$(curl -fsS "${auth[@]}" "$GW/api/profile-types" \
  | jq -r '.[] | select(.code=="shrimp") | .profile_type_id')
EXISTING=$(curl -fsS "${auth[@]}" "$GW/api/projects/all" \
  | jq -r '.[] | select(.name=="Demo Farm") | .projectId // .project_id' | head -1)
if [[ -n "$EXISTING" && "$EXISTING" != "null" ]]; then
  PROJECT="$EXISTING"; echo "   reusing project $PROJECT"
else
  PROJECT=$(curl -fsS -X POST "${auth[@]}" -H 'Content-Type: application/json' \
    "$GW/api/projects" \
    -d "{\"name\":\"Demo Farm\",\"description\":\"Local e2e demo\",\"profileTypeId\":\"$PROFILE_ID\"}" \
    | jq -r '.project_id')
  echo "   created project $PROJECT"
fi

say "grant admin membership on the project + refresh token (snapshot version bump)"
curl -fsS -X PUT "${auth[@]}" -H 'Content-Type: application/json' \
  "$GW/api/users/$ADMIN_ID/access" -d "{\"projectIds\":[\"$PROJECT\"]}" >/dev/null
TOKEN=$(curl -fsS -X POST "$GW/api/auth/refresh" -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}" | jq -r .token)
auth=(-H "Authorization: Bearer $TOKEN")

say "ponds"
mkpond() {
  local name="$1"
  local id
  id=$(curl -fsS "${auth[@]}" "$GW/api/ponds?projectId=$PROJECT" \
    | jq -r --arg n "$name" '(.ponds // .)[]? | select(.name==$n) | .pond_id' | head -1)
  if [[ -z "$id" || "$id" == "null" ]]; then
    id=$(curl -fsS -X POST "${auth[@]}" -H 'Content-Type: application/json' \
      "$GW/api/projects/$PROJECT/ponds" -d "{\"name\":\"$name\"}" | jq -r '.pond_id')
  fi
  echo "$id"
}
POND_A=$(mkpond "Pond Alpha"); echo "   Pond Alpha: $POND_A"
POND_B=$(mkpond "Pond Beta");  echo "   Pond Beta:  $POND_B"

say "sensor type + device + port mappings"
PARAM_IDS=$(curl -fsS "${auth[@]}" "$GW/api/parameter-types" | jq -r \
  '[.[] | select(.parameter_code=="temperature" or .parameter_code=="ph"
     or .parameter_code=="dissolved_oxygen" or .parameter_code=="ammonium"
     or .parameter_code=="turbidity" or .parameter_code=="electricity")
   | .parameter_id]')
SENSOR_TYPE=$(curl -fsS -X POST "${auth[@]}" -H 'Content-Type: application/json' \
  "$GW/api/sensor-types" \
  -d "{\"name\":\"Demo Multiprobe\",\"model_number\":\"DMP-1\",\"parameter_ids\":$PARAM_IDS}" \
  | jq -r '.sensor_type_id // empty') || true
if [[ -z "${SENSOR_TYPE:-}" ]]; then
  SENSOR_TYPE=$(curl -fsS "${auth[@]}" "$GW/api/sensor-types" \
    | jq -r '.[] | select(.name=="Demo Multiprobe") | .sensor_type_id' | head -1)
  echo "   reusing sensor type $SENSOR_TYPE"
fi
curl -fsS -X POST "${auth[@]}" -H 'Content-Type: application/json' "$GW/api/iot-devices" \
  -d "{\"device_code\":\"$DEVICE_CODE\",\"device_name\":\"Local Gateway\",\"device_key\":\"$DEVICE_KEY\"}" \
  >/dev/null 2>&1 || echo "   device exists (ok)"
mkmapping() {
  local pond="$1" port="$2" serial="$3"
  curl -fsS -X POST "${auth[@]}" -H 'Content-Type: application/json' \
    "$GW/api/projects/$PROJECT/sensors" \
    -d "{\"pond_id\":\"$pond\",\"sensor_type_id\":\"$SENSOR_TYPE\",\"device_code\":\"$DEVICE_CODE\",\"port\":\"$port\",\"serial_number\":\"$serial\"}" \
    >/dev/null 2>&1 || echo "   mapping $port exists (ok)"
}
mkmapping "$POND_A" "A1" "SN-A"
mkmapping "$POND_B" "A2" "SN-B"

say "chart config (SQL — the monolith seeded project_visualisations via migrations)"
docker exec aq-postgres psql -q -U aquashield -d aquashield -c "
  INSERT INTO project.project_visualisations
    (project_id, visualisation_type_id, enabled, flag, y_parameters, title)
  SELECT '$PROJECT', vt.visualisation_type_id, true, 0, vt.required_parameters, vt.name
  FROM project.visualisation_types vt
  WHERE NOT EXISTS (
    SELECT 1 FROM project.project_visualisations pv
    WHERE pv.project_id = '$PROJECT'
      AND pv.visualisation_type_id = vt.visualisation_type_id);"
echo "   8 chart types enabled (analytics caches config 60s — first charts call may lag)"

say "thresholds (ph 6.5-8.5 key) + energy settings (0.25 USD, hourly alert > 2.0)"
curl -fsS -X PUT "${auth[@]}" -H 'Content-Type: application/json' \
  "$GW/api/projects/$PROJECT/parameter-settings" \
  -d '[{"parameter_code":"ph","min_threshold":6.5,"max_threshold":8.5,"is_key_parameter":true}]' >/dev/null
curl -fsS -X PUT "${auth[@]}" -H 'Content-Type: application/json' \
  "$GW/api/projects/$PROJECT/energy/settings" \
  -d '{"tariffPerUnit":0.25,"currency":"USD","highHourlyThreshold":2.0}' >/dev/null

say "backfill 72h of signed telemetry (both ponds) + one ph breach"
python3 - "$PUBSUB" "$PUBSUB_PROJECT" "$DEVICE_CODE" "$DEVICE_KEY" <<'PYEOF'
import base64, hashlib, hmac, json, random, sys, time, urllib.request, uuid

pubsub, gcp_project, device_code, device_key = sys.argv[1:5]
url = f"{pubsub}/v1/projects/{gcp_project}/topics/iot.telemetry.received:publish"
random.seed(42)

def sign(payload: dict) -> str:
    body = {k: v for k, v in payload.items() if k != "sig"}
    canonical = json.dumps(body, separators=(",", ":"), sort_keys=True)
    return hmac.new(device_key.encode(), canonical.encode(), hashlib.sha256).hexdigest()

def publish(messages):
    data = json.dumps({"messages": [
        {"data": base64.b64encode(json.dumps(m).encode()).decode()} for m in messages
    ]}).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req).read()

now = int(time.time())
seq = now  # monotonic, unique across reruns (dedup is (device, seq_no))
batch, count = [], 0
for hours_back in range(72, 0, -1):
    ts = now - hours_back * 3600
    measured = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))
    for port, bias in (("A1", 0.0), ("A2", 0.6)):
        readings = [
            {"parameter": "temperature", "value": round(27.5 + bias + random.uniform(-1, 1), 2)},
            {"parameter": "ph", "value": round(7.4 + bias / 3 + random.uniform(-0.3, 0.3), 2)},
            {"parameter": "dissolved_oxygen", "value": round(6.0 - bias + random.uniform(-0.8, 0.8), 2)},
            {"parameter": "ammonium", "value": round(0.25 + bias / 4 + random.uniform(-0.1, 0.1), 3)},
            {"parameter": "turbidity", "value": round(11 + bias * 4 + random.uniform(-2, 2), 1)},
            {"parameter": "electricity", "value": round(random.uniform(0.4, 2.6), 2)},
        ]
        seq += 1
        payload = {
            "device_code": device_code,
            "seq_no": seq,
            "measured_at": measured,
            "ts": ts,
            "sensor_batches": [{"port": port, "readings": readings}],
        }
        payload["sig"] = sign(payload)
        batch.append({
            "eventId": str(uuid.uuid4()),
            "eventType": "iot.telemetry.received",
            "schemaVersion": "v1",
            "correlationId": str(uuid.uuid4()),
            "payload": payload,
        })
        count += 1
        if len(batch) >= 25:
            publish(batch); batch = []
# one fresh ph breach on Pond Alpha -> alert.created (threshold max 8.5)
seq += 1
breach = {
    "device_code": device_code, "seq_no": seq,
    "measured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now)),
    "ts": now,
    "sensor_batches": [{"port": "A1", "readings": [{"parameter": "ph", "value": 9.2}]}],
}
breach["sig"] = sign(breach)
batch.append({"eventId": str(uuid.uuid4()), "eventType": "iot.telemetry.received",
              "schemaVersion": "v1", "correlationId": str(uuid.uuid4()), "payload": breach})
publish(batch)
print(f"   published {count + 1} telemetry messages")
PYEOF

say "waiting for ingestion to drain"
sleep 8

TODAY=$(date +%F)
START=$(date -v-3d +%F 2>/dev/null || date -d '3 days ago' +%F)
say "verification through the gateway"
echo "   charts keys:      $(curl -fsS "${auth[@]}" "$GW/api/projects/$PROJECT/charts/?pondId=$POND_A&startDate=$START&endDate=$TODAY" | jq -r 'keys | join(", ")')"
echo "   comparison ammonium: $(curl -fsS "${auth[@]}" "$GW/api/projects/$PROJECT/pond-comparison?pondAId=$POND_A&pondBId=$POND_B&startDate=$START&endDate=$TODAY" | jq -c '.metrics[0] | {pondAValue, pondBValue, percentDifference}')"
echo "   energy totalKwh:  $(curl -fsS "${auth[@]}" "$GW/api/projects/$PROJECT/energy/dashboard?groupBy=day&startDate=$START&endDate=$TODAY" | jq '.kpis.totalKwh')"
echo "   alerts:           $(curl -fsS "${auth[@]}" "$GW/api/alerts?projectId=$PROJECT" | jq '.alerts | length') active"

say "DONE — login at the frontend with admin@aquashield.local / AdminBoot123!"
echo "   project: $PROJECT"
echo "   ponds:   $POND_A (Alpha) / $POND_B (Beta)"
