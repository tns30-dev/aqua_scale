# Project Sensors — ERD Finalization

---

## Current State

### project_sensors
| Column | Type | Notes |
|--------|------|-------|
| project_sensor_id | UUID (PK) | `gen_random_uuid()` |
| project_id | UUID (FK → projects) | ON DELETE CASCADE |
| pond_id | UUID (FK → ponds) | ON DELETE RESTRICT |
| sensor_type_id | UUID (FK → sensor_types) | ON DELETE RESTRICT |
| iot_device_id | UUID (FK → iot_devices) | ON DELETE SET NULL |
| port | VARCHAR(32) | Required if device assigned |
| serial | VARCHAR(128) | ⚠️ Duplicate of serial_number |
| serial_number | VARCHAR(255) | |
| status | VARCHAR(50) | `'active'`, `'inactive'`, `'maintenance'` |
| installed_at | DATE | |
| sensor_location | POINT | GPS coordinates |
| created_at | TIMESTAMPTZ | |
| created_by | UUID | |
| updated_at | TIMESTAMPTZ | Auto (trigger) |
| updated_by | UUID | |

### sensors (legacy — TO BE DROPPED)

Redundant with `project_sensors`. Same columns minus `project_id` and audit trail. No longer needed.

---

## Refined Schema (1 Table)

### project_sensors

| Column | Type | Notes |
|--------|------|-------|
| project_sensor_id | UUID (PK) | |
| project_id | UUID (FK → projects) | ON DELETE CASCADE |
| pond_id | UUID (FK → ponds) | ON DELETE RESTRICT |
| sensor_type_id | UUID (FK → sensor_types) | ON DELETE RESTRICT |
| iot_device_id | UUID (FK → iot_devices) | ON DELETE SET NULL |
| port | VARCHAR(32) | Required if device assigned |
| serial_number | VARCHAR(255) | |
| status | VARCHAR(50) | `'active'`, `'inactive'`, `'maintenance'` |
| installed_at | DATE | |
| sensor_location | POINT | GPS coordinates |
| created_at | TIMESTAMPTZ | |
| created_by | UUID (FK → users) | |
| updated_at | TIMESTAMPTZ | Auto (trigger) |
| updated_by | UUID (FK → users) | |

> Table is mostly clean. Note: `created_by` and `updated_by` should be proper FKs to `users` (currently just UUID with no FK constraint).

---

## Use Case Mapping

> **⚠️ Use case diagram mismatch:** The labels in the diagram are swapped — "View Sensor Types" (top) shows use cases that actually belong to `project_sensors`, and "View Project Sensors" (bottom) shows use cases that actually belong to `sensor_types`. The mapping below is based on **what fits this table**. Use case diagram to be refined later.

The correct use cases for `project_sensors` are from the **top** section of the diagram (labelled "View Sensor Types"):

| Use Case | Table/Column |
|----------|-------------|
| Assign/Modify Project | `project_sensors.project_id` (FK → projects) |
| Assign/Modify Pond | `project_sensors.pond_id` (FK → ponds) |
| Assign/Modify Sensor Type | `project_sensors.sensor_type_id` (FK → sensor_types) |
| Assign/Modify IoT | `project_sensors.iot_device_id` (FK → iot_devices) |
| Set Port | `project_sensors.port` |
| Set GPS coordinates | `project_sensors.sensor_location` (POINT) |
| Set installed datetime | `project_sensors.installed_at` |
| Set activate | `project_sensors.status` |
| Add/Modify serial no | `project_sensors.serial_number` |

---

## Relationships

```
project_sensors (N) ←── (1) projects
project_sensors (N) ←── (1) ponds
project_sensors (N) ←── (1) sensor_types
project_sensors (N) ←── (1) iot_devices

project_sensors (1) ──→ (N) sensor_readings (readings from this sensor)
```

---

*Last updated: April 17, 2026*