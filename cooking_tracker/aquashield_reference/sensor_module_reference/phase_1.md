# Phase 1 — Cleanup & Model Audit

---

## Goal

Establish a clean baseline before any admin work. Two jobs:

1. **Delete the dead `Sensor` cruft (D4)** — the commented-out `Sensor` model block, the commented `SensorSerializer`, and the legacy commented `admin.py` content. No comment-and-keep; this module is being stabilized, so it gets a clean slate.
2. **Audit the three in-scope models** (`SensorType`, `IoTDevice`, `ProjectSensor`) against the live DB — fields, `db_column`, FK `on_delete`, `related_name`, status `choices`. They already look aligned; this phase *confirms* it and fixes any drift, so Phases 2–4 build on solid models.

**No admin is written in this phase.** `admin.py` is emptied to a clean stub; registration starts in Phase 2.

---

## Background (current state)

- `module_sensor/models.py` — `SensorType`, `IoTDevice`, `ProjectSensor` present and ~aligned to DB; `Sensor` block **commented out** (was retired earlier); `SensorMessage` + `SensorReading` present (dormant).
- `module_sensor/admin.py` — **entirely commented**, imports the dropped `Sensor`, registers only `SensorType` + `Sensor`.
- `module_sensor/serializers.py` — `SensorSerializer` **commented out**; `SensorType` + ingest serializers active.
- `module_sensor/services.py` — imports `ParameterType` from `module_project` (correct, dormant ingestion helper). **Do not touch (D1).**

---

## Live DB shape to validate models against (introspected 2026-06-02)

- `sensor_types`: `sensor_type_id, name, model_number(UNIQUE), manufacturer, parameter_ids(uuid[]), description, is_active, created_at, updated_at`; CHECK `cardinality(parameter_ids)>0`.
- `iot_devices`: `iot_device_id, device_code(UNIQUE), device_name, status, config(jsonb), is_active, device_key, created_at/by, updated_at/by`; CHECK status ∈ {online, offline, maintenance}.
- `project_sensors`: `project_sensor_id, project_id, pond_id, sensor_type_id, iot_device_id(null), port, serial, serial_number(UNIQUE), status, installed_at, sensor_location(point), created_at/by, updated_at/by`; CHECKs (status enum; device⇒port); FKs project=CASCADE, pond=RESTRICT, sensor_type=RESTRICT, iot_device=SET NULL.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | Pre-check | Grep for any remaining **live** references to the `Sensor` model (class, import, `SensorSerializer`) across `module_sensor/` + prod repo. Confirm only commented/dead occurrences remain (we retired it earlier). | grep — only commented refs + non-prod scripts |
| 2 | [x] | Delete — `models.py` | Remove the commented-out `Sensor` class block entirely (the `# class Sensor...` lines). | block gone; `grep -n "Sensor(" models.py` shows none |
| 3 | [x] | Delete — `serializers.py` | Remove the commented-out `SensorSerializer` block. Confirm `Sensor` is not imported. | block gone; import clean |
| 4 | [x] | Reset — `admin.py` | Replace the fully-commented file with a clean module docstring + `from django.contrib import admin` stub (no registrations yet — Phases 2–4 add them). | file parses; no dead `Sensor` import |
| 5 | [x] | Audit — `SensorType` | Confirm fields + `db_column` + `db_table='sensor_types'` match DB. Confirm `parameter_ids` is `ArrayField(UUIDField)`. Note: no `choices`/CHECK enforced at model — handled at admin form (Phase 2/5). | field-by-field diff vs DB |
| 6 | [x] | Audit — `IoTDevice` | Confirm fields match DB incl. `device_key`, `config`, audit cols. Ensure `status` has `choices` (online/offline/maintenance) on the model or note it for the Phase-3 form. | diff vs DB |
| 7 | [x] | Audit — `ProjectSensor` | Confirm 4 FKs + `on_delete` (CASCADE/RESTRICT/RESTRICT/SET_NULL) + `related_name='project_sensors'`, `serial_number` unique, `sensor_location` TextField, `status` choices. | diff vs DB constraints |
| 8 | [x] | Confirm dormant | `SensorMessage`, `SensorReading`, `services.py`, `mqtt_adapter.py`, ingest serializers — **untouched** (D1). | git diff shows no changes to these |
| 9 | [x] | Verify | `manage.py check` clean (only pre-existing staticfiles warning); `ruff check` clean on `models.py`, `serializers.py`, `admin.py`. | commands pass |

---

## Verification Block

```bash
cd /Users/thetnaungsoe/Desktop/AquaMonitoringv2/backend

# No live Sensor model references remain
grep -rn "\bSensor\b" module_sensor/ | grep -vE "SensorType|SensorMessage|SensorReading|ProjectSensor|#"

# Models import + load cleanly
./venv/bin/python manage.py check 2>&1 | grep -iE "error|issue"

# Lint touched files
./venv/bin/ruff check module_sensor/models.py module_sensor/serializers.py module_sensor/admin.py

# Models still match DB (spot check field count)
./venv/bin/python manage.py shell -c "from module_sensor.models import SensorType, IoTDevice, ProjectSensor; print('ok')"
```

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| Deleting the `Sensor` block breaks a hidden importer | Step 1 grep already done earlier (only seed/verification scripts referenced it, both non-prod and already trimmed). Re-confirm. |
| `services.py` import of `ParameterType` looks "wrong" but is correct (moved to module_project) | Out of scope (D1) — do not touch. |
| Ruff pre-existing noise (trailing whitespace, I001) in `models.py`/`serializers.py` | Pre-existing; leave per owner rule. Only assert *no new* errors. |

---

## Out of scope

| Item | Why |
|---|---|
| Writing any admin registration | Phases 2–4 |
| Touching ingestion (services/mqtt/messages/readings) | D1 |
| Migrations | `managed=False` — none authored |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | Commented `Sensor` model block removed from `models.py` |
| [x] | Commented `SensorSerializer` removed from `serializers.py` |
| [x] | `admin.py` is a clean stub (no dead `Sensor` import, no registrations) |
| [x] | The 3 models confirmed field-aligned with the live DB |
| [x] | Ingestion files untouched (D1) |
| [x] | `manage.py check` clean; ruff clean on touched files |

---

## Files Touched in Phase 1

| File | What changed |
|---|---|
| `backend/module_sensor/models.py` | Removed commented-out `Sensor` class block. |
| `backend/module_sensor/serializers.py` | Removed commented-out `SensorSerializer` block. |
| `backend/module_sensor/admin.py` | Reset to a clean stub (docstring + `from django.contrib import admin`). |

---

*Last updated: 2026-06-02*
