# Phase 3 — IoTDevice Admin

---

## Goal

Build the Django admin for `IoTDevice` (table `iot_devices`) — the Raspberry-Pi gateway. Two sensitivities: `device_key` is an **HMAC secret** (must not be casually exposed/edited), and `config` is JSONB (wants a friendlier editor than a raw textarea). `status` is a closed enum.

---

## What IoTDevice is

A physical gateway addressed by `device_code` (e.g. `RBP-1000`, used in the MQTT topic). It signs messages with `device_key`. `config` holds sampling rate / USB-port mapping. One IoTDevice → many ProjectSensors (via ports).

DB: UNIQUE(`device_code`); CHECK `status ∈ {online, offline, maintenance}`.

---

## Admin shape

```
IoTDeviceAdmin
  list_display  : device_code, device_name, status, is_active, created_at
  search_fields : device_code, device_name
  list_filter   : status, is_active
  ordering      : device_code
  readonly      : iot_device_id, created_at, created_by, updated_at, updated_by
  form          : IoTDeviceAdminForm  (status choices + config widget)
  fieldsets     : Identity(device_code, device_name)
                  Status(status, is_active)
                  Config(config)
                  Security(device_key)        # see decision below
                  Audit(...)  [collapse]
```

### `device_key` (HMAC secret) handling

Pick the safest workable option during build (default to **A**):
- **A (default):** exclude `device_key` from the change form entirely (not rendered, not editable here) — rotation happens out-of-band. Display only a "key set ✓ / not set" boolean in `list_display` if useful (never the value).
- **B:** render it `readonly` and **masked** (show `••••` + last 4) — visible-but-not-editable.

Whichever — **never** put the raw secret in an editable text input or in `list_display`.

### `status` choices

Ensure the model field has `choices=[('online','Online'),('offline','Offline'),('maintenance','Maintenance')]` (add if missing in Phase 1 audit) so the admin renders a dropdown and the form enforces the enum (mirrors the DB CHECK).

### `config` (JSONB) widget

Reuse `module_pond`'s `KeyValuePairsWidget` (Alpine-backed key/value editor) if `config` is flat-ish; otherwise fall back to the default JSON textarea. Don't over-engineer — a working JSON editor is enough.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | Model | Confirm/add `status` `choices` on `IoTDevice` (online/offline/maintenance). | model renders dropdown |
| 2 | [x] | Form | `IoTDeviceAdminForm` — status dropdown; `config` widget (reuse `KeyValuePairsWidget` or default JSON). | form instantiates |
| 3 | [x] | Security | Decide A/B for `device_key`; implement (default: exclude from form). Confirm secret is not in `list_display` or any editable field. | grep + manual: key not rendered editable |
| 4 | [x] | Admin | `@admin.register(IoTDevice)` with list/search/filter/readonly/fieldsets. | add/change render |
| 5 | [x] | Round-trip | Create/edit a device: status dropdown saves; config persists; `device_code` uniqueness enforced (try a dup → form error). | manual + DB |
| 6 | [x] | Verify | `manage.py check` clean; ruff clean on touched files. | commands pass |

---

## Verification Block

```bash
cd /Users/thetnaungsoe/Desktop/AquaMonitoringv2/backend
./venv/bin/python manage.py check 2>&1 | grep -iE "error|issue"
./venv/bin/ruff check module_sensor/admin.py module_sensor/forms.py

# device_key must NOT appear in admin form fields
./venv/bin/python manage.py shell <<'PY'
from module_sensor.admin import IoTDeviceAdmin
from django.contrib.admin.sites import site
from module_sensor.models import IoTDevice
ma = IoTDeviceAdmin(IoTDevice, site)
print("form fields:", list(ma.get_form(None)().fields.keys()))
PY
```
Manual: `/admin/module_sensor/iotdevice/` add+change render; status is a dropdown; `device_key` not editable/visible-as-value; duplicate `device_code` rejected.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| Secret leakage via `list_display`/form/readonly value | Step 3 explicitly verifies `device_key` is excluded (default A). |
| `config` JSON widget breaks on non-flat JSON | Fall back to default JSON textarea; KeyValue widget only if shape is flat. |
| Audit `created_by`/`updated_by` are raw UUIDs (not FKs) | Keep `readonly`; display as-is. Not in scope to FK-ify. |
| `status` choices mismatch DB enum | Use exactly {online, offline, maintenance}. |

---

## Out of scope

| Item | Why |
|---|---|
| ProjectSensor admin | Phase 4 |
| Key rotation flow / MQTT auth | Ingestion (D1) |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `IoTDevice` registered; add/change render |
| [x] | `status` is a dropdown enforcing the enum |
| [x] | `device_key` is not editable/exposed as a value anywhere |
| [x] | `config` editable (key-value or JSON) and round-trips |
| [x] | duplicate `device_code` rejected |
| [x] | `manage.py check` + ruff clean |

---

## Files Touched in Phase 3

| File | What changed |
|---|---|
| `backend/module_sensor/admin.py` | `IoTDeviceAdmin` registration. |
| `backend/module_sensor/forms.py` | `IoTDeviceAdminForm` (status, config, device_key handling). |
| `backend/module_sensor/models.py` | `status` `choices` if missing (audit follow-up). |

---

*Last updated: 2026-06-02*
