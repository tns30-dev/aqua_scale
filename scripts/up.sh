#!/usr/bin/env bash
# ONE COMMAND: bring up the entire AquaShield platform in Docker.
#   infra (postgres/redis/pubsub/bigtable) + topic bootstrap + all 9 services + gateway
#
#   ./scripts/up.sh            build (cached) + start everything
#   ./scripts/up.sh --no-build start with existing images
#
# Then:  ./scripts/seed-demo.sh                         (demo data)
#        cd frontend && npm run dev                     (http://localhost:5173)
#        login admin@aquashield.local / AdminBoot123!
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

[[ -f local/dev-keys/jwt-private.pem ]] || ./scripts/gen-dev-keys.sh
export JWT_PUBLIC_KEY_PEM="$(cat local/dev-keys/jwt-public.pem)"
export JWT_PRIVATE_KEY_PEM="$(cat local/dev-keys/jwt-private.pem)"

BUILD="--build"
[[ "${1:-}" == "--no-build" ]] && BUILD=""

docker compose --profile app up -d $BUILD

echo
echo ">> waiting for the gateway + services"
tries=90
# any HTTP status from the gateway (incl. 401 on a protected route) = platform answering
until [[ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/api/profile-types 2>/dev/null)" =~ ^(200|401)$ ]]; do
  tries=$((tries - 1))
  [[ $tries -gt 0 ]] || { echo "!! gateway not answering — docker compose ps / logs"; exit 1; }
  sleep 2
done
docker compose --profile app ps --format 'table {{.Name}}\t{{.Status}}'
echo
echo ">> platform UP behind http://localhost:8080"
echo ">> next: ./scripts/seed-demo.sh   then: cd frontend && npm run dev"
