#!/usr/bin/env bash
# Bootstrap the decided Pub/Sub topic/subscription/DLQ catalogue on the local emulator.
# Catalogue source of truth: cooking_tracker/main/pub_sub_contract_docs.md
# Usage: ./scripts/pubsub-bootstrap.sh  (emulator must be up: docker compose up -d)
# Portable: works on macOS bash 3.2 (no associative arrays).

set -euo pipefail

HOST="${PUBSUB_EMULATOR_HOST:-localhost:8085}"
PROJECT="${PUBSUB_PROJECT_ID:-aquashield-local}"
BASE="http://${HOST}/v1/projects/${PROJECT}"

# "topic:subscriber1,subscriber2" — subscription naming: <service>.<topic>.sub
CATALOGUE="
iot.telemetry.received:ingestion
sensor.message.validated:audit
sensor.message.rejected:audit
reading.ingested:notification,realtime,audit
reading.quarantined:audit
threshold.violated:realtime,audit
alert.created:realtime,audit
alert.resolved:realtime,audit
notification.requested:dispatcher
notification.sent:audit
audit.event.recorded:audit
project.created:audit
project.updated:audit
project.settings.updated:notification,audit
"

# idempotent: 409 (already exists) is fine on re-runs
create_topic() {
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${BASE}/topics/$1")
  case "${status}" in
    200) echo "  topic: $1" ;;
    409) echo "  topic: $1 (exists)" ;;
    *)   echo "  topic: $1 FAILED (${status})" >&2; return 1 ;;
  esac
}

# create_sub <sub-name> <topic> [dlq-topic]
create_sub() {
  local sub="$1" topic="$2" dlq="${3:-}"
  local body status
  if [ -n "${dlq}" ]; then
    body="{\"topic\":\"projects/${PROJECT}/topics/${topic}\",\"ackDeadlineSeconds\":30,\"deadLetterPolicy\":{\"deadLetterTopic\":\"projects/${PROJECT}/topics/${dlq}\",\"maxDeliveryAttempts\":5}}"
  else
    body="{\"topic\":\"projects/${PROJECT}/topics/${topic}\",\"ackDeadlineSeconds\":30}"
  fi
  status=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "${BASE}/subscriptions/${sub}" \
    -H "Content-Type: application/json" -d "${body}")
  case "${status}" in
    200) echo "  sub:   ${sub}${dlq:+ (DLQ: ${dlq})}" ;;
    409) echo "  sub:   ${sub} (exists)" ;;
    *)   echo "  sub:   ${sub} FAILED (${status})" >&2; return 1 ;;
  esac
}

echo "Bootstrapping Pub/Sub catalogue on ${HOST} (project: ${PROJECT})"

echo "${CATALOGUE}" | while IFS=: read -r topic subscribers; do
  [ -z "${topic}" ] && continue
  create_topic "${topic}"
  create_topic "${topic}.dlq"
  echo "${subscribers}" | tr ',' '\n' | while read -r svc; do
    [ -z "${svc}" ] && continue
    create_sub "${svc}.${topic}.sub" "${topic}" "${topic}.dlq"
  done
  # plain inspection subscription on the DLQ topic (no dead-letter policy)
  create_sub "dlq-inspect.${topic}.sub" "${topic}.dlq"
done

echo "Done. Verify: curl -s http://${HOST}/v1/projects/${PROJECT}/topics"
