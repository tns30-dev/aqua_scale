# Sensor Management — Overall Plan

> Stabilize `module_sensor` to the same bar as user / project / pond. The module is currently **broken at the admin layer** — `admin.py` is fully commented out, it referenced the now-dropped `Sensor` model, and it never registered `IoTDevice` or `ProjectSensor`. This arc retires the dead `Sensor` cruft and builds a clean, validated **Django-admin-only** surface for the three in-scope models. No REST API, no frontend. The MQTT ingestion pipeline is left dormant and untouched.

---

## Why this arc

`module_sensor` was last refined April 2026 as an 8-model module. Since then the pond/project/user arcs reshaped it:

1. **`ParameterType` + `ProjectParameterSetting` moved out** to `module_project` (project-mgmt Phase 3). `module_sensor/services.py` already imports `ParameterType` from there.
2. **`Sensor` (table `sensors`) was dropped** — superseded by `ProjectSensor`. The model block is commented out; its table no longer exists; the legacy admin/serializer still reference it.
3. **`admin.py` is 100% commented out** and only ever tried to register `SensorType` + the dropped `Sensor`. `IoTDevice` and `ProjectSensor` have **no admin at all**.

Net: the three real sensor-hardware models are aligned to the live DB, but you can't manage any of them from the admin. This arc fixes exactly that.

---

## Scope

| Model | DB table | In scope? | Notes |
|---|---|---|---|
| `SensorType` | `sensor_types` | ✅ **YES** | Hardware catalogue. `parameter_ids UUID[]` → ParameterType (module_project). |
| `IoTDevice` | `iot_devices` | ✅ **YES** | Raspberry-Pi gateway. Holds `device_key` (HMAC secret) + `config` JSONB. |
| `ProjectSensor` | `project_sensors` | ✅ **YES** | The **hub** — ties Project + Pond + SensorType + IoTDevice. |
| `Sensor` | `sensors` (dropped) | ❌ DELETE | Dead. Commented model block + serializer + legacy admin → removed (D4). |
| `SensorMessage` | `sensor_messages` | ⛔ DORMANT | Ingestion. Untouched (D1). Not admin-displayed. |
| `SensorReading` | `sensor_readings` | ⛔ DORMANT | Ingestion (22-col table). Untouched (D1). Not admin-displayed. |

**Also out of scope (dormant, untouched per D1):** `services.py`, `management/commands/mqtt_adapter.py`, the ingest serializers (`ReadingSerializer`, `SensorBatchSerializer`, `SensorIngestSerializer`), `views.py` (empty), `module_sensor/fixtures/parameter_types.json`.

---

## The three models — live DB shape (introspected 2026-06-02)

### `sensor_types`
`sensor_type_id` (uuid PK) · `name` · `model_number` (UNIQUE) · `manufacturer` · `parameter_ids` (uuid[]) · `description` · `is_active` · `created_at` · `updated_at`
**Constraints:** UNIQUE(model_number) · CHECK `cardinality(parameter_ids) > 0`

### `iot_devices`
`iot_device_id` (uuid PK) · `device_code` (UNIQUE) · `device_name` · `status` · `config` (jsonb) · `is_active` · `device_key` (text, HMAC secret) · `created_at/by` · `updated_at/by`
**Constraints:** UNIQUE(device_code) · CHECK status ∈ {online, offline, maintenance}

### `project_sensors`  (the hub)
`project_sensor_id` (uuid PK) · `project_id` · `pond_id` · `sensor_type_id` · `iot_device_id` (nullable) · `port` · `serial` · `serial_number` (UNIQUE) · `status` · `installed_at` · `sensor_location` (point) · `created_at/by` · `updated_at/by`
**Constraints:**
- UNIQUE(serial_number)
- CHECK status ∈ {active, inactive, maintenance}
- **CHECK: `iot_device_id IS NULL OR (port IS NOT NULL AND trim(port) <> '')`** — device ⇒ port required
- partial-unique `(iot_device_id, port)` WHERE status='active' (and a second partial index WHERE both non-null)
- FKs: `project` → CASCADE · `pond` → RESTRICT · `sensor_type` → RESTRICT · `iot_device` → SET NULL

All three models are `managed = False` (schema is owned by SQL, Django never runs DDL).

---

## Source-of-truth references

| Source | Use |
|---|---|
| **Live dev DB `aquaculture`** (introspected) | Ground truth for columns + constraints. Beats the ERD image where they disagree. |
| `project_mgmt_reference/AquaShield UML Diagrams-ERD Diagram.drawio-2.png` (May 21) | Latest ERD — sensor tables on the right; relationship cross-check. |
| `tns_reference/module_sensor/{models,learning,services,serializers}.md` | Owner's refinement notes (April 25). **Caveat: describes the OLD 8-model state** — `ParameterType`/`ProjectParameterSetting` since moved, `Sensor` dropped. Use for intent, not current truth. |
| `tns_reference/db_schema/module_sensor_tables.md` | DB schema doc. |
| `archive/class_and_arch_diagram_refinement/class_4_module_sensor.md` | Class diagram (methods). |
| `project_mgmt_reference/` (admin patterns) | Template — custom admin forms/widgets (theme decompose, indicator checkbox, JSON key-value widget) to mirror. |

---

## Resolved decisions

- **D1 — Ingestion pipeline:** ✅ **Leave dormant & untouched.** `services.py`, `mqtt_adapter.py`, `SensorMessage`, `SensorReading`, ingest serializers — none touched this arc.
- **D2 — `SensorType.parameter_ids`:** ✅ **Editable multi-select custom widget** in admin (mirrors the project indicator-checkbox picker). Choices = `ParameterType` catalogue (module_project); value stored as `UUID[]`.
- **D3 — `ProjectSensor.sensor_location` (POINT):** ✅ **Lat/Lng inputs.** Admin form decomposes the stored POINT into two numeric fields and recomposes on save (mirrors the theme-colour decompose pattern in `ProfileTypeAdminForm`).
- **D4 — Dead `Sensor` cruft:** ✅ **Delete it all** (commented model block, dead serializer, legacy admin) for a clean slate — not the usual comment-and-keep.

---

## Phases (concrete checklists in `phase_N.md`)

- **Phase 1 — Cleanup & model audit.** Delete dead `Sensor` artifacts (commented model block in `models.py`, commented `SensorSerializer`, legacy `admin.py` content). Audit the 3 models against the live DB (fields, `db_column`, FKs, `related_name`, choices). Confirm `SensorMessage`/`SensorReading`/services stay dormant. Baseline `manage.py check` + ruff clean.
- **Phase 2 — SensorType admin.** Register with list/search/readonly-audit. Custom multi-select widget for `parameter_ids` (D2). Form-validate the `parameter_ids` non-empty CHECK.
- **Phase 3 — IoTDevice admin.** Register with list/search. `status` choices; `device_key` excluded/masked (secret); `config` JSON widget (reuse module_pond `KeyValuePairsWidget` if it fits). Readonly audit fields.
- **Phase 4 — ProjectSensor admin (the hub).** Register with list/filter/search; autocomplete FKs (project/pond/sensor_type/iot_device). Lat/Lng decompose widget for `sensor_location` (D3). Fieldsets (Assignment / Device / Status / Location / Audit).
- **Phase 5 — Validation, enforcement & verification.** Mirror the DB CHECKs as admin-form `clean()` validation (status enums, `parameter_ids` non-empty, device⇒port, `(iot_device, port)` active-uniqueness, serial uniqueness). Lightweight form-validation tests + admin add/change smoke for all three.

---

## Engineering rules (carry-over, applied to this arc)

- One checklist item per edit; track in the phase doc immediately.
- Schema is owned by SQL; all three models are `managed = False` — **no migrations authored** this arc.
- Code changes land in the **prod repo** (`/Users/thetnaungsoe/Desktop/AquaMonitoringv2`); these reference docs live in the learning repo.
- No auto-commits; per-action approval for any git op.
- Verification per phase: `manage.py check` clean (only the pre-existing staticfiles warning), `ruff` clean on touched files, and admin add/change smoke. Form-validation unit tests where they add real signal.
- Respect owner conventions: no explanatory/justifying comments on edits; don't bundle unrelated dead-code cleanup (the `Sensor` deletion is in-scope per D4, not a bundle).

---

## Phase status

```text
Sensor Management (admin stabilization)                         DONE
  Phase 1 (Cleanup & model audit)                               DONE
  Phase 2 (SensorType admin + parameter_ids widget)             DONE
  Phase 3 (IoTDevice admin)                                     DONE
  Phase 4 (ProjectSensor admin — the hub + lat/lng)             DONE
  Phase 5 (Validation, enforcement & verification)              DONE
```

Phase 5 note: validation verified via live-DB form exercise (`phase5_verification.py`, 8/8 PASS)
rather than a pytest suite — `managed=False` models have no Django-migration test DB, and wiring
module_sensor to the shared `test_sql` bootstrap is deferred test-infra work, not part of this arc.

## Phase 1 audit findings (carry into later phases)

- `SensorType.model_number` lacks `unique=True` though DB has UNIQUE → add or handle in form (Phase 2/5 unique check).
- `IoTDevice.device_code` lacks `unique=True` though DB has UNIQUE → Phase 3/5.
- `IoTDevice.status` has **no `choices`** (DB CHECK online/offline/maintenance) → add in Phase 3.
- `SensorType.parameter_ids` non-empty CHECK not enforced at model → Phase 2 form.
- `ProjectSensor` confirmed fully aligned (FKs, `serial_number` unique, `status` choices, `sensor_location` TextField).
- Confirmed: `ParameterType` PK column is `parameter_id` (validated via `SensorType.get_parameters()`), good for the Phase 2 picker.

## Phase 4 finding — CREATE-blocking timestamp bug (fixed)

`IoTDevice` + `ProjectSensor` declared `created_at`/`updated_at` as `null=True` with **no auto**, but the DB columns are **NOT NULL** (with `DEFAULT now()`). Django sends explicit `NULL`, overriding the default → **admin CREATE 500s**. Fixed by making them `auto_now_add=True` / `auto_now=True` (matching `SensorType`). This also retroactively fixes IoTDevice CREATE (Phase 3). `sensor_types` columns are nullable, so SensorType was unaffected.

---

*Last updated: 2026-06-02*
