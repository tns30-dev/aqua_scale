# Daily Health Scheduler And Cycle Metrics

## Source Feature

The updated monolith adds a daily scheduler that folds `alert_log` into
`cycle_daily_health`, while preserving human-edited rows. It also hardens
`cycle_stage_metrics` uniqueness.

## Source Files

- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_pond/services/daily_health.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/module_pond/management/commands/compute_daily_health.py`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/deploy/systemd/daily-health.service`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/deploy/systemd/daily-health.timer`
- `/Users/thetnaungsoe/Desktop/AquamonitoringV2/backend/sql/aquashield_schema_20260801_update.sql`

## Source Behavior

- Default target date is yesterday.
- Active cycles on the target date get a daily health row.
- Status thresholds match `DailyHealthService.derive_status`: `alert >= 3` -> poor,
  `alert >= 2` -> fair, `alert >= 1` -> good, `warning >= 2` -> good, else excellent.
- `cycle_daily_health.alert_count` stores alert-severity rows only; warnings affect status
  but are not added to that column.
- Resolved and acknowledged rows still count because the scheduler counts daily alert-log
  occurrences, not active-alert state.
- Project-level energy alerts are excluded because only pond-scoped alerts are queried.
- Human-edited health rows are never overwritten.
- Cycles are active only when `start_date <= target`, `status = ongoing`, and `end_date` is
  null or still on/after the target date. A stale ongoing status does not override `end_date`.
- Backfill mode computes multiple closed days.

## Target Ownership

- `pond-service`: daily health computation and cycle metric uniqueness.
- `notification-service`: alert data source.
- Platform/K8s: scheduled job equivalent to systemd timer.

## Current Target Gap

The microservice target has `cycle_daily_health` tables and detail responses, but no
visible scheduled computation path. It also currently documents no unique constraint on
`cycle_stage_metrics`, while the updated source now adds one.

## Microservice Translation Notes

- Implemented as an internal notification gRPC read contract instead of cross-schema table
  reads from `pond-service`.
- Implemented as a Kubernetes `CronJob`, not systemd.
- `cycle_daily_health` now has audit/update columns so scheduler-created rows can be
  updated safely while human-edited rows are preserved.
- Profile cycle length is derived from stage `endDay` values with the DB day-number cap of
  200, matching the updated monolith behavior.

## Target Files Changed

- `shared-api/src/main/proto/notification.proto`
- `notification-service/src/main/java/com/aquashield/notification/repo/AlertLogRepository.java`
- `notification-service/src/main/java/com/aquashield/notification/grpc/NotificationGrpcService.java`
- `pond-service/src/main/java/com/aquashield/pond/config/GrpcClientsConfig.java`
- `pond-service/src/main/java/com/aquashield/pond/domain/Entities.java`
- `pond-service/src/main/java/com/aquashield/pond/repo/Repos.java`
- `pond-service/src/main/java/com/aquashield/pond/service/DailyHealthService.java`
- `pond-service/src/main/java/com/aquashield/pond/jobs/DailyHealthJobRunner.java`
- `pond-service/src/main/resources/application.yml`
- `pond-service/src/main/resources/db/migration/V4__daily_health_scheduler.sql`
- `pond-service/src/test/java/com/aquashield/pond/service/DailyHealthServiceTest.java`
- `k8s/base/jobs/pond-daily-health/cronjob.yaml`
- `k8s/base/services/pond-service/configmap.yaml`
- `k8s/base/kustomization.yaml`
- `docker-compose.yml`

## Sync Plan

1. Done: use notification gRPC `GetPondAlertCounts` for grouped daily alert/warning counts.
2. Done: add pond-service computation service and job entry point.
3. Done: add K8s CronJob manifest for daily execution at 00:15 Asia/Singapore.
4. Partial: focused rule tests added for status derivation and profile cap logic. Full
   DB-backed idempotency/backfill tests are still a good later integration-test target.
5. Done: reconciled `cycle_stage_metrics` uniqueness with second-round source behavior.

## Verification

- `mvn -pl shared-api,notification-service,pond-service -am -DskipTests compile`
- `mvn -pl pond-service -am -Dtest=DailyHealthServiceTest,FeedingServiceMathTest,TreatmentServiceMathTest,ComparisonMathTest -Dsurefire.failIfNoSpecifiedTests=false test`
- `kubectl kustomize k8s/base`

## Status

Implemented: first microservice slice synced.
