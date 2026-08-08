#!/usr/bin/env bash
# Second-round local demo seed for Demo Shrimp Farm.
#
# Setup goes through the gateway APIs for project/pond/device ownership. The large
# historical dataset is loaded with guarded local SQL because it backfills months of
# readings, feeding, treatments, electricity, and alert occurrences.
#
# Usage:
#   ALLOW_LOCAL_SQL_SEED=yes ./scripts/seed-bangka-demo.sh
#
# Prereqs: local compose stack + gateway + services are running. Requires curl, jq,
# python3-compatible date is not needed; SQL uses Postgres current_date.

set -euo pipefail

if [[ "${ALLOW_LOCAL_SQL_SEED:-}" != "yes" ]]; then
  cat >&2 <<'EOF'
Refusing to run a direct SQL seed without ALLOW_LOCAL_SQL_SEED=yes.

This script is for the local demo database only. It replaces Demo Shrimp Farm
readings/cycles/feed/treatments from 2026-01-01 onward.
EOF
  exit 2
fi

GW="${GW:-http://localhost:8080}"
DB_CONTAINER="${DB_CONTAINER:-aq-postgres}"
DB_USER="${DB_USER:-aquashield}"
DB_NAME="${DB_NAME:-aquashield}"
PROJECT_NAME="Demo Shrimp Farm"
DEVICE_CODE="DEV-BANGKA-DEMO"
DEVICE_KEY="bangka-demo-device-key"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/sql/seed-bangka-demo-local.sql"

say() { printf '\n>> %s\n' "$*"; }

say "admin login"
LOGIN=$(curl -fsS -X POST "$GW/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@aquashield.local","password":"AdminBoot123!"}')
TOKEN=$(jq -r .token <<<"$LOGIN")
REFRESH=$(jq -r .refreshToken <<<"$LOGIN")
ADMIN_ID=$(jq -r .user.userId <<<"$LOGIN")
auth=(-H "Authorization: Bearer $TOKEN")
echo "   admin: $ADMIN_ID"

say "resolve shrimp profile + create/reuse project"
PROFILE_ID=$(curl -fsS "${auth[@]}" "$GW/api/profile-types" | jq -r \
  '.[] | select((.code // .profileTypeCode)=="shrimp") | (.profile_type_id // .profileTypeId)' \
  | head -1)
if [[ -z "$PROFILE_ID" || "$PROFILE_ID" == "null" ]]; then
  echo "Could not resolve shrimp profile type." >&2
  exit 1
fi

PROJECT=$(curl -fsS "${auth[@]}" "$GW/api/projects/all" | jq -r --arg n "$PROJECT_NAME" \
  '.[] | select(.name==$n) | (.projectId // .project_id)' | head -1)
if [[ -n "$PROJECT" && "$PROJECT" != "null" ]]; then
  echo "   reusing project $PROJECT"
else
  PROJECT=$(curl -fsS -X POST "${auth[@]}" -H 'Content-Type: application/json' \
    "$GW/api/projects" \
    -d "{\"name\":\"$PROJECT_NAME\",\"description\":\"Second-round BangKa-pattern demo\",\"profileTypeId\":\"$PROFILE_ID\"}" \
    | jq -r '.project_id // .projectId')
  echo "   created project $PROJECT"
fi

say "grant admin membership + refresh token snapshot"
curl -fsS -X PUT "${auth[@]}" -H 'Content-Type: application/json' \
  "$GW/api/users/$ADMIN_ID/access" -d "{\"projectIds\":[\"$PROJECT\"]}" >/dev/null
TOKEN=$(curl -fsS -X POST "$GW/api/auth/refresh" -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}" | jq -r .token)
auth=(-H "Authorization: Bearer $TOKEN")

say "create/reuse ponds A-E"
mkpond() {
  local name="$1"
  local id
  id=$(curl -fsS "${auth[@]}" "$GW/api/ponds?projectId=$PROJECT" | jq -r --arg n "$name" \
    '(.ponds // .)[]? | select(.name==$n) | (.pond_id // .pondId)' | head -1)
  if [[ -z "$id" || "$id" == "null" ]]; then
    id=$(curl -fsS -X POST "${auth[@]}" -H 'Content-Type: application/json' \
      "$GW/api/projects/$PROJECT/ponds" \
      -d "{\"name\":\"$name\",\"metadata\":{\"seed\":\"bangka-demo-2026\"}}" \
      | jq -r '.pond_id // .pondId')
  fi
  echo "$id"
}
POND_A=$(mkpond "Pond A"); echo "   Pond A: $POND_A"
POND_B=$(mkpond "Pond B"); echo "   Pond B: $POND_B"
POND_C=$(mkpond "Pond C"); echo "   Pond C: $POND_C"
POND_D=$(mkpond "Pond D"); echo "   Pond D: $POND_D"
POND_E=$(mkpond "Pond E"); echo "   Pond E: $POND_E"

say "sensor type + device + five port mappings"
PARAM_IDS=$(curl -fsS "${auth[@]}" "$GW/api/parameter-types" | jq -r '
  [
    .[] as $p
    | select([
        "temperature", "salinity", "ph", "dissolved_oxygen", "water_level",
        "tan", "alkalinity", "calcium", "magnesium", "nitrate", "nitrite",
        "ammonia", "ammonium", "phosphate", "total_hardness",
        "total_vibrio_count", "total_bacteria_count", "electricity"
      ] | index($p.parameter_code))
    | $p.parameter_id
  ]')

SENSOR_TYPE=$(curl -fsS -X POST "${auth[@]}" -H 'Content-Type: application/json' \
  "$GW/api/sensor-types" \
  -d "{\"name\":\"BangKa Demo Multiprobe\",\"model_number\":\"BDM-2026\",\"parameter_ids\":$PARAM_IDS}" \
  | jq -r '.sensor_type_id // .sensorTypeId // empty') || true
if [[ -z "${SENSOR_TYPE:-}" ]]; then
  SENSOR_TYPE=$(curl -fsS "${auth[@]}" "$GW/api/sensor-types" | jq -r \
    '.[] | select(.name=="BangKa Demo Multiprobe") | (.sensor_type_id // .sensorTypeId)' \
    | head -1)
  echo "   reusing sensor type $SENSOR_TYPE"
fi

curl -fsS -X POST "${auth[@]}" -H 'Content-Type: application/json' "$GW/api/iot-devices" \
  -d "{\"device_code\":\"$DEVICE_CODE\",\"device_name\":\"BangKa Demo Gateway\",\"device_key\":\"$DEVICE_KEY\"}" \
  >/dev/null 2>&1 || echo "   device exists (ok)"

mkmapping() {
  local pond="$1" port="$2" serial="$3"
  curl -fsS -X POST "${auth[@]}" -H 'Content-Type: application/json' \
    "$GW/api/projects/$PROJECT/sensors" \
    -d "{\"pond_id\":\"$pond\",\"sensor_type_id\":\"$SENSOR_TYPE\",\"device_code\":\"$DEVICE_CODE\",\"port\":\"$port\",\"serial_number\":\"$serial\"}" \
    >/dev/null 2>&1 || echo "   mapping $port exists (ok)"
}
mkmapping "$POND_A" "BKA-A" "BANGKA-A"
mkmapping "$POND_B" "BKA-B" "BANGKA-B"
mkmapping "$POND_C" "BKA-C" "BANGKA-C"
mkmapping "$POND_D" "BKA-D" "BANGKA-D"
mkmapping "$POND_E" "BKA-E" "BANGKA-E"

say "load BangKa-pattern local SQL seed"
docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -v ALLOW_BANGKA_DEMO_SEED=1 \
  -U "$DB_USER" -d "$DB_NAME" < "$SQL_FILE"

say "verification through gateway"
TODAY=$(date +%F)
START=$(date -v-30d +%F 2>/dev/null || date -d '30 days ago' +%F)
echo "   charts keys: $(curl -fsS "${auth[@]}" "$GW/api/projects/$PROJECT/charts/?pondId=$POND_A&startDate=$START&endDate=$TODAY" | jq -r 'keys | join(", ")')"
echo "   comparison nitrite: $(curl -fsS "${auth[@]}" "$GW/api/projects/$PROJECT/pond-comparison?pondAId=$POND_A&pondBId=$POND_B&parameters=nitrite&startDate=$START&endDate=$TODAY" | jq -c '.metrics[0] | {pondAValue, pondBValue, percentDifference}')"
echo "   energy totalKwh: $(curl -fsS "${auth[@]}" "$GW/api/projects/$PROJECT/energy/dashboard?groupBy=day&startDate=$START&endDate=$TODAY" | jq '.kpis.totalKwh')"
echo "   active alerts: $(curl -fsS "${auth[@]}" "$GW/api/alerts?projectId=$PROJECT" | jq '.alerts | length')"

say "DONE"
echo "   project: $PROJECT_NAME / $PROJECT"
echo "   ponds:   $POND_A $POND_B $POND_C $POND_D $POND_E"
