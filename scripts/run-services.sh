#!/usr/bin/env bash
# Start ALL AquaShield services on the host for the local e2e stack.
# Prereqs: docker compose up -d (pg 5433 / redis 6380 / pubsub 8085 / gateway 8080)
#          ./scripts/pubsub-bootstrap.sh
# Usage:   ./scripts/run-services.sh            (builds first)
#          SKIP_BUILD=1 ./scripts/run-services.sh
# Stop:    ./scripts/stop-services.sh
# Logs:    local/run/logs/<service>.log

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RUN="$ROOT/local/run"
mkdir -p "$RUN/logs" "$RUN/pids"

export JWT_PUBLIC_KEY_PEM="$(cat local/dev-keys/jwt-public.pem)"
JWT_PRIVATE="$(cat local/dev-keys/jwt-private.pem)"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo ">> building jars (skip with SKIP_BUILD=1)"
  mvn -q -DskipTests package
  echo ">> building analytics"
  (cd analytics-service && npm run build >/dev/null)
fi

alive() { [[ -f "$RUN/pids/$1.pid" ]] && kill -0 "$(cat "$RUN/pids/$1.pid")" 2>/dev/null; }

start_java() {
  local name="$1"; shift
  if alive "$name"; then echo "   $name already running"; return; fi
  local jar
  jar=$(ls "$name"/target/"$name"-*.jar 2>/dev/null | grep -v original | head -1)
  [[ -n "$jar" ]] || { echo "!! no jar for $name (build first)"; exit 1; }
  ( env "$@" nohup java -jar "$jar" > "$RUN/logs/$name.log" 2>&1 &
    echo $! > "$RUN/pids/$name.pid" )
  echo "   $name started (pid $(cat "$RUN/pids/$name.pid"))"
}

echo ">> starting services"
start_java identity-access-service \
  JWT_PRIVATE_KEY_PEM="$JWT_PRIVATE" \
  BOOTSTRAP_ADMIN_EMAIL="admin@aquashield.local" \
  BOOTSTRAP_ADMIN_PASSWORD="AdminBoot123!"
start_java project-service
start_java sensor-service
# HMAC_MAX_SKEW widened LOCALLY so the seed script can backfill historical readings
start_java ingestion-service HMAC_MAX_SKEW=PT240H
start_java notification-service
start_java realtime-gateway
start_java pond-service
start_java audit-service

if alive analytics-service; then
  echo "   analytics-service already running"
else
  ( nohup node analytics-service/dist/index.js \
      > "$RUN/logs/analytics-service.log" 2>&1 &
    echo $! > "$RUN/pids/analytics-service.pid" )
  echo "   analytics-service started (pid $(cat "$RUN/pids/analytics-service.pid"))"
fi

echo ">> waiting for health"
wait_health() {
  local name="$1" url="$2" tries=60
  until curl -fsS "$url" >/dev/null 2>&1; do
    tries=$((tries - 1))
    [[ $tries -gt 0 ]] || { echo "!! $name not healthy — see $RUN/logs/$name.log"; exit 1; }
    sleep 2
  done
  echo "   $name UP"
}
wait_health identity-access-service http://localhost:8081/actuator/health
wait_health project-service        http://localhost:8082/actuator/health
wait_health sensor-service         http://localhost:8083/actuator/health
wait_health ingestion-service      http://localhost:8084/actuator/health
wait_health notification-service   http://localhost:8087/actuator/health
wait_health realtime-gateway       http://localhost:8088/actuator/health
wait_health pond-service           http://localhost:8089/actuator/health
wait_health analytics-service      http://localhost:8090/healthz
wait_health audit-service          http://localhost:8092/actuator/health

echo ">> all services UP. Gateway: http://localhost:8080  (compose 'gateway' service)"
echo ">> seed demo data: ./scripts/seed-demo.sh"
echo ">> frontend:       cd frontend && npm run dev   (proxy targets the gateway via .env)"
