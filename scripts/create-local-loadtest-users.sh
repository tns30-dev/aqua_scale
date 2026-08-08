#!/usr/bin/env bash
# Create/reuse local load-test users through the gateway admin API.
#
# Usage:
#   ALLOW_LOCAL_LOADTEST_USERS=yes ./scripts/create-local-loadtest-users.sh

set -euo pipefail

if [[ "${ALLOW_LOCAL_LOADTEST_USERS:-}" != "yes" ]]; then
  cat >&2 <<'EOF'
Refusing to create local load-test users without ALLOW_LOCAL_LOADTEST_USERS=yes.

This writes users and project grants into the local identity database. It is for
performance rehearsal/evidence data only.
EOF
  exit 2
fi

GW="${GW:-http://localhost:8080}"
COUNT="${COUNT:-50}"
EMAIL_TEMPLATE="${EMAIL_TEMPLATE:-loadtest%03d@example.com}"
PASSWORD="${PASSWORD:-loadtest-pass-2026}"
PROJECT_NAME="${PROJECT_NAME:-Demo Shrimp Farm}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@aquashield.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-AdminBoot123!}"

COOKIE="$(mktemp)"
cleanup() {
  rm -f "$COOKIE"
}
trap cleanup EXIT

say() { printf '\n>> %s\n' "$*"; }

format_email() {
  local n="$1"
  local padded
  padded="$(printf "%03d" "$n")"
  case "$EMAIL_TEMPLATE" in
    *"{:03d}"*) printf "%s" "${EMAIL_TEMPLATE//\{:03d\}/$padded}" ;;
    *"%03d"*) printf "$EMAIL_TEMPLATE" "$n" ;;
    *"{}"*) printf "%s" "${EMAIL_TEMPLATE//\{\}/$n}" ;;
    *"{n}"*) printf "%s" "${EMAIL_TEMPLATE//\{n\}/$n}" ;;
    *) printf "%s" "$EMAIL_TEMPLATE" ;;
  esac
}

say "admin login"
CSRF_JSON="$(curl -fsS -c "$COOKIE" "$GW/api/csrf")"
CSRF="$(jq -r '.csrfToken // empty' <<<"$CSRF_JSON")"
curl -fsS -b "$COOKIE" -c "$COOKIE" -X POST "$GW/api/auth/login" \
  -H 'Content-Type: application/json' \
  -H "X-CSRFToken: $CSRF" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" >/dev/null

say "resolve project"
PROJECT_ID="$(curl -fsS -b "$COOKIE" "$GW/api/projects/all" | jq -r --arg n "$PROJECT_NAME" \
  '.[] | select(.name==$n) | (.projectId // .project_id)' | head -1)"
if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "null" ]]; then
  echo "Could not resolve project: $PROJECT_NAME" >&2
  exit 1
fi
echo "   project: $PROJECT_NAME / $PROJECT_ID"

USERS_JSON="$(curl -fsS -b "$COOKIE" "$GW/api/users")"

say "create/reuse $COUNT load-test users"
for n in $(seq 1 "$COUNT"); do
  email="$(format_email "$n")"
  exists="$(jq -r --arg email "$email" '.[] | select(.email==$email) | .userId' <<<"$USERS_JSON" | head -1)"
  if [[ -n "$exists" ]]; then
    echo "   exists: $email"
    continue
  fi

  first_name="Loadtest"
  last_name="$(printf "%03d" "$n")"
  body="$(jq -nc \
    --arg email "$email" \
    --arg password "$PASSWORD" \
    --arg firstName "$first_name" \
    --arg lastName "$last_name" \
    --arg projectId "$PROJECT_ID" \
    '{
      email: $email,
      password: $password,
      firstName: $firstName,
      lastName: $lastName,
      mobileNumber: "",
      role: "user",
      projectIds: [$projectId]
    }')"

  curl -fsS -b "$COOKIE" -c "$COOKIE" -X POST "$GW/api/users" \
    -H 'Content-Type: application/json' \
    -H "X-CSRFToken: $CSRF" \
    -d "$body" >/dev/null
  echo "   created: $email"
done

say "DONE"
cat <<EOF
Use for k6:
  LOADTEST_EMAIL_TEMPLATE='loadtest{:03d}@example.com'
  LOADTEST_PASSWORD='$PASSWORD'
EOF
