# Phase 5 — Validation, Enforcement & Verification

---

## Goal

The models are `managed = False`, so the database CHECK constraints won't fire on a normal Django admin save the way a `NOT NULL` would — they're enforced by Postgres only at write time, surfacing as raw `IntegrityError` 500s instead of friendly form errors. This phase makes the admin **mirror every relevant DB CHECK as form-level `clean()` validation**, so bad input is rejected with a clear message *before* hitting the DB. Then a verification sweep across all three admins.

This is the sensor-side counterpart to the validators we built for `profile_stages` and `cycle_stage_metric`.

---

## Constraints to mirror at the form layer

| Model | DB constraint | Admin form rule |
|---|---|---|
| `SensorType` | CHECK `cardinality(parameter_ids) > 0` | already in Phase 2 — confirm `clean_parameter_ids` rejects empty |
| `SensorType` | UNIQUE `model_number` | ModelForm validates unique automatically — confirm |
| `IoTDevice` | CHECK `status ∈ {online, offline, maintenance}` | `choices` dropdown (Phase 3) — confirm enum enforced |
| `IoTDevice` | UNIQUE `device_code` | ModelForm unique — confirm |
| `ProjectSensor` | CHECK `status ∈ {active, inactive, maintenance}` | `choices` / `clean_status` |
| `ProjectSensor` | CHECK device⇒port (`iot_device set ⇒ port non-empty`) | `clean()`: if `iot_device` and not `port.strip()` → error |
| `ProjectSensor` | partial-unique `(iot_device_id, port)` among **active** | `clean()`: query existing active ProjectSensors with same (iot_device, port), excluding self → error on collision |
| `ProjectSensor` | UNIQUE `serial_number` | ModelForm unique — confirm |

For the active-uniqueness check: only enforce when `iot_device` is set, `port` is set, and `status == 'active'`; exclude the current instance (`self.instance.pk`).

---

## Tests (lightweight, where they add signal)

Add form-validation unit tests (same style as the `stage_config` / `CycleStageMetric` tests) — bind each admin form with data and assert valid/invalid. No need for full HTTP admin tests.

- `SensorTypeAdminForm`: empty `parameter_ids` rejected; valid accepted; round-trips UUIDs.
- `IoTDeviceAdminForm`: bad `status` rejected; duplicate `device_code` rejected.
- `ProjectSensorAdminForm`: device-without-port rejected; duplicate active `(iot_device, port)` rejected; lat/lng both-or-neither; valid accepted.

(If the module's `tests.py` is currently a stub, add a small `tests/` or extend `tests.py`. Reuse the live-DB-backed shell-test approach used elsewhere this session if a full test DB run is awkward.)

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | SensorType | Confirm `parameter_ids` non-empty + `model_number` unique are enforced at the form. | form test |
| 2 | [x] | IoTDevice | Confirm `status` enum + `device_code` unique enforced. | form test |
| 3 | [x] | ProjectSensor | Add `clean()`: device⇒port rule. | form test: device+no port → error |
| 4 | [x] | ProjectSensor | Add `clean()`: active `(iot_device, port)` uniqueness (exclude self). | form test: dup active → error |
| 5 | [x] | ProjectSensor | Confirm `status` enum + `serial_number` unique enforced. | form test |
| 6 | [x] | Tests | Add form-validation unit tests for all three forms. | tests pass |
| 7 | [x] | Smoke | Manually open add + change for all 3 models; submit one invalid + one valid each; confirm friendly errors (no 500s). | manual |
| 8 | [x] | Verify | `manage.py check` clean; ruff clean on all touched files. | commands pass |
| 9 | [x] | Docs | Update `overall.md` phase-status block → all phases done; note any deviations. | doc updated |

---

## Verification Block

```bash
cd /Users/thetnaungsoe/Desktop/AquaMonitoringv2/backend
./venv/bin/python manage.py check 2>&1 | grep -iE "error|issue"
./venv/bin/ruff check module_sensor/admin.py module_sensor/forms.py

# Run the new form-validation tests (adjust path to where they land)
./venv/bin/pytest module_sensor/ -p no:warnings -q 2>&1 | tail -8
```
Manual smoke per model: invalid submit → field error shown (not a 500); valid submit → saves.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| Active-uniqueness query forgets `exclude(pk=self.instance.pk)` → blocks editing the row itself | Explicit exclude; test edits an existing row. |
| ModelForm unique validation skipped because `managed=False` | Django still runs `validate_unique` on ModelForms regardless of `managed`; confirm via the duplicate test. |
| `module_sensor` test DB bootstrap differs (recall the module_user `test_sql` path issue) | If pytest DB setup is awkward, fall back to live-DB shell tests (as used for the stage validators this session). |
| Over-strict validation blocks legitimate inactive duplicates | Active-uniqueness only applies when `status=='active'`; inactive/maintenance rows are exempt (matches the partial index). |

---

## Out of scope

| Item | Why |
|---|---|
| Ingestion pipeline validation | D1 |
| REST/FE | not this module's scope |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | Every relevant DB CHECK has a matching admin-form rule (status enums, parameter_ids non-empty, device⇒port, active port-uniqueness, uniques) |
| [x] | Invalid admin input → friendly form error, never a raw 500 |
| [x] | Form-validation tests pass for all 3 forms |
| [x] | `manage.py check` + ruff clean |
| [x] | `overall.md` status block updated to DONE |

---

## Files Touched in Phase 5

| File | What changed |
|---|---|
| `backend/module_sensor/forms.py` | `ProjectSensorAdminForm.clean()` (device⇒port, active port-uniqueness); confirm/extend the other forms' validation. |
| `backend/module_sensor/tests.py` (or `tests/`) | Form-validation unit tests for the three admin forms. |
| `sensor_module_reference/overall.md` | Phase-status block → DONE. |

---

*Last updated: 2026-06-02*
