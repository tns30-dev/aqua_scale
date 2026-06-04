# Phase 4 — ProjectSensor Admin (the hub)

---

## Goal

Build the Django admin for `ProjectSensor` (table `project_sensors`) — the **central junction** that ties Project + Pond + SensorType + IoTDevice + port together ("in this project, at this pond, this sensor type is connected to this device on this port"). Headline piece: **Lat/Lng inputs for `sensor_location`** (D3), decomposed from / recomposed to the stored POINT.

---

## What ProjectSensor is

The installed-sensor record. Four FKs (with different delete rules), a port mapping that lets incoming MQTT data find the right pond, a unique serial number, a status enum, and a GPS location.

DB constraints (enforce relevant ones at the form, Phase 5 consolidates):
- UNIQUE(`serial_number`)
- CHECK `status ∈ {active, inactive, maintenance}`
- CHECK device⇒port (`iot_device_id IS NULL OR port non-empty`)
- partial-unique `(iot_device_id, port)` among active
- FKs: project=CASCADE, pond=RESTRICT, sensor_type=RESTRICT, iot_device=SET NULL

---

## Admin shape

```
ProjectSensorAdmin
  list_display       : serial_number, project, pond, sensor_type, iot_device, port, status, installed_at
  list_filter        : status, sensor_type, project
  search_fields      : serial_number, pond__name, project__name, iot_device__device_code
  ordering           : serial_number
  autocomplete_fields: project, pond, sensor_type, iot_device
  readonly           : project_sensor_id, created_at, created_by, updated_at, updated_by
  form               : ProjectSensorAdminForm  (lat/lng decompose)
  fieldsets          : Assignment(project, pond, sensor_type)
                       Device(iot_device, port, serial, serial_number)
                       Status(status, installed_at)
                       Location(latitude, longitude)
                       Audit(...) [collapse]
```

> `autocomplete_fields` need `search_fields` on the *target* admins:
> - `sensor_type` → SensorTypeAdmin has `search_fields` (Phase 2) ✓
> - `iot_device` → IoTDeviceAdmin has `search_fields` (Phase 3) ✓
> - `project`, `pond` → confirm their admins (module_project / module_pond) define `search_fields`; if not, either add them there or drop those from `autocomplete_fields` (use raw_id or default select).

## Lat/Lng decompose widget (D3)

`sensor_location` is a PostGIS `point` mapped as `TextField` in the model. Mirror the theme-colour decompose pattern from `ProfileTypeAdminForm`:

- `ProjectSensorAdminForm` declares two `forms.FloatField`s: `latitude` (required=False), `longitude` (required=False).
- `__init__`: parse the instance's `sensor_location` text into lat/lng and set as `initial`. **Confirm the stored text format first** — PostgreSQL `point` renders as `(x,y)` where x=longitude, y=latitude (note the order). Parse defensively (also accept WKT `POINT(lng lat)`).
- `save()`: recompose `sensor_location` from the two inputs into the canonical stored format. If both blank → store `NULL`/empty. If only one provided → validation error (need both or neither).
- `latitude` and `longitude` are **form-only** fields (not on the model) — exclude `sensor_location` from the rendered fieldset (it's set in `save()`).

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | Pre-check | Inspect a real `project_sensors.sensor_location` value to confirm the stored text format (x=lng,y=lat order). | DB query |
| 2 | [x] | Pre-check | Confirm `module_project` Project admin + `module_pond` Pond admin define `search_fields` (needed for autocomplete). | grep admins |
| 3 | [x] | Form | `ProjectSensorAdminForm` — `latitude`/`longitude` FloatFields; `__init__` parses `sensor_location` → initial. | form instantiates with parsed values |
| 4 | [x] | Form | `save()` recomposes `sensor_location`; both-or-neither validation for lat/lng. | unit test: round-trip + one-blank rejected |
| 5 | [x] | Admin | `@admin.register(ProjectSensor)` with list/filter/search/autocomplete/readonly/fieldsets. | add/change render |
| 6 | [x] | Round-trip | Create/edit: pick project/pond/sensor_type via autocomplete, set lat/lng, save, reopen → values persist; `sensor_location` correct in DB. | manual + DB |
| 7 | [x] | Delete behavior | Confirm admin delete reflects FK rules: a ProjectSensor referencing a pond blocks pond delete (RESTRICT, already verified in pond work); deleting a ProjectSensor itself works. | manual |
| 8 | [x] | Verify | `manage.py check` clean; ruff clean. | commands pass |

---

## Verification Block

```bash
cd /Users/thetnaungsoe/Desktop/AquaMonitoringv2/backend

# Inspect stored POINT format
./venv/bin/python manage.py shell <<'PY'
from module_sensor.models import ProjectSensor
for ps in ProjectSensor.objects.exclude(sensor_location__isnull=True)[:3]:
    print(repr(ps.sensor_location))
PY

# Target admins have search_fields (autocomplete prereq)
grep -rn "search_fields" ../backend/module_project/admin.py ../backend/module_pond/admin.py

./venv/bin/python manage.py check 2>&1 | grep -iE "error|issue"
./venv/bin/ruff check module_sensor/admin.py module_sensor/forms.py
```
Manual: `/admin/module_sensor/projectsensor/` add+change render; FK autocompletes work; lat/lng round-trip; one-blank lat/lng rejected.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| POINT text format / axis order misread (lng,lat vs lat,lng) | Step 1 inspects real values before coding the parser; round-trip test confirms. |
| Autocomplete needs `search_fields` on Project/Pond admins | Step 2 checks; if missing, add there or fall back to default select. |
| device⇒port CHECK + (iot_device,port) uniqueness not enforced here | Deferred to Phase 5 (consolidated `clean()`); Phase 4 focuses on shape + location. |
| `created_by`/`updated_by` raw UUIDs | readonly display; not FK-ified (out of scope). |

---

## Out of scope

| Item | Why |
|---|---|
| Consolidated CHECK validation (status, device⇒port, port uniqueness) | Phase 5 |
| Tests | Phase 5 |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `ProjectSensor` registered; add/change render |
| [x] | FK fields usable (autocomplete or sensible fallback) |
| [x] | `sensor_location` edited as Lat/Lng, round-trips to POINT correctly |
| [x] | lat/lng both-or-neither enforced |
| [x] | `manage.py check` + ruff clean |

---

## Files Touched in Phase 4

| File | What changed |
|---|---|
| `backend/module_sensor/admin.py` | `ProjectSensorAdmin` registration. |
| `backend/module_sensor/forms.py` | `ProjectSensorAdminForm` (lat/lng decompose). |
| `backend/module_project/admin.py` / `module_pond/admin.py` | `search_fields` only **if** missing for autocomplete (else untouched). |

---

*Last updated: 2026-06-02*
