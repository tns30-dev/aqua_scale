# Sensor Messages & Sensor Readings — ERD Finalization

---

## Data Flow

```
IoT Device sends raw message
        ↓
sensor_messages (raw payload stored)
        ↓ identification / filtering
sensor_readings (parsed parameter values)
```

---

## Current State

### sensor_messages
| Column | Type | Notes |
|--------|------|-------|
| sensor_message_id | UUID (PK) | `gen_random_uuid()` |
| iot_device_id | UUID (FK → iot_devices) | ON DELETE CASCADE |
| seq_no | INTEGER | Unique per device |
| measured_at | TIMESTAMPTZ | When sensor measured |
| received_at | TIMESTAMPTZ | When backend received |
| transport_type | VARCHAR(50) | |
| raw_message | JSONB | Original payload from device |
| created_at | TIMESTAMPTZ | |
| created_by | UUID | |
| updated_at | TIMESTAMPTZ | Auto (trigger) |
| updated_by | UUID | |

### sensor_readings
| Column | Type | Notes |
|--------|------|-------|
| sensor_reading_id | UUID (PK) | `gen_random_uuid()` |
| sensor_message_id | UUID (FK → sensor_messages) | ON DELETE CASCADE |
| project_sensor_id | UUID (FK → project_sensors) | ON DELETE RESTRICT |
| pond_id | UUID (FK → ponds) | ON DELETE RESTRICT |
| temperature | DECIMAL | |
| salinity | DECIMAL | |
| ph | DECIMAL | |
| water_level | DECIMAL | |
| dissolved_oxygen | DECIMAL | |
| turbidity | DECIMAL | |
| nitrate | DECIMAL | |
| nitrite | DECIMAL | |
| ammonia | DECIMAL | |
| ammonium | DECIMAL | |
| ph_lab | DECIMAL | |
| carbonate | DECIMAL | |
| bicarbonate | DECIMAL | |
| tan | DECIMAL | |
| alkalinity | DECIMAL | |
| calcium | DECIMAL | |
| magnesium | DECIMAL | |
| phosphate | DECIMAL | |
| total_hardness | DECIMAL | |
| hydrogen_sulfide | DECIMAL | |
| total_vibrio_count | DECIMAL | |
| total_bacteria_count | DECIMAL | |
| measured_at | TIMESTAMPTZ | |
| received_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| created_by | UUID | |
| updated_at | TIMESTAMPTZ | Auto (trigger) |
| updated_by | UUID | |

---

## Refined Schema (2 Tables — no changes needed)

### sensor_messages

| Column | Type | Notes |
|--------|------|-------|
| sensor_message_id | UUID (PK) | |
| iot_device_id | UUID (FK → iot_devices) | ON DELETE CASCADE |
| seq_no | INTEGER | Unique per device |
| measured_at | TIMESTAMPTZ | When sensor measured |
| received_at | TIMESTAMPTZ | When backend received |
| transport_type | VARCHAR(50) | e.g., MQTT, HTTP |
| raw_message | JSONB | Original payload from device |
| created_at | TIMESTAMPTZ | |
| created_by | UUID (FK → users) | |
| updated_at | TIMESTAMPTZ | Auto (trigger) |
| updated_by | UUID (FK → users) | |

> Table is stable — no changes needed.

### sensor_readings

| Column | Type | Notes |
|--------|------|-------|
| sensor_reading_id | UUID (PK) | |
| sensor_message_id | UUID (FK → sensor_messages) | ON DELETE CASCADE. Links back to raw message |
| project_sensor_id | UUID (FK → project_sensors) | ON DELETE RESTRICT. Which sensor produced this |
| pond_id | UUID (FK → ponds) | ON DELETE RESTRICT. Which pond this reading belongs to |
| temperature | DECIMAL | °C |
| salinity | DECIMAL | ppt |
| ph | DECIMAL | |
| water_level | DECIMAL | cm |
| dissolved_oxygen | DECIMAL | mg/L |
| turbidity | DECIMAL | NTU |
| nitrate | DECIMAL | mg/L |
| nitrite | DECIMAL | mg/L |
| ammonia | DECIMAL | mg/L |
| ammonium | DECIMAL | mg/L |
| ph_lab | DECIMAL | |
| carbonate | DECIMAL | mg/L |
| bicarbonate | DECIMAL | mg/L |
| tan | DECIMAL | mg/L |
| alkalinity | DECIMAL | mg/L |
| calcium | DECIMAL | mg/L |
| magnesium | DECIMAL | mg/L |
| phosphate | DECIMAL | mg/L |
| total_hardness | DECIMAL | mg/L |
| hydrogen_sulfide | DECIMAL | mg/L |
| total_vibrio_count | DECIMAL | CFU/mL |
| total_bacteria_count | DECIMAL | CFU/mL |
| measured_at | TIMESTAMPTZ | When sensor measured |
| received_at | TIMESTAMPTZ | When backend received |
| created_at | TIMESTAMPTZ | |
| created_by | UUID (FK → users) | |
| updated_at | TIMESTAMPTZ | Auto (trigger) |
| updated_by | UUID (FK → users) | |

> Table is stable — no changes needed. Note: 22 parameter columns are hardcoded as columns (not EAV/JSONB). This matches `parameter_types` entries. If new parameters are added to `parameter_types`, a schema migration is needed to add the column.

---

## Relationships

```
iot_devices (1) ──→ (N) sensor_messages (1) ──→ (N) sensor_readings

sensor_readings (N) ←── (1) project_sensors
sensor_readings (N) ←── (1) ponds
```

---

## How It Works

```
1. IoT device sends raw JSON payload
   → Stored in sensor_messages.raw_message (JSONB)
   → Linked to iot_device via iot_device_id

2. Backend processes the raw message:
   → Identifies which project_sensor and pond the data belongs to
   → Parses parameter values from raw payload
   → Creates sensor_readings row with parsed values in individual columns

3. sensor_readings is the "clean" table used by:
   → Real-time & Forecast page (latest readings)
   → Historical page (trend charts)
   → Alert system (threshold comparison)
   → Overview page (key parameters tooltip)
```

---

## Warning

> **Electricity consumption:** Need to check how to measure later. The sensor_messages table receives raw payloads continuously from IoT devices — high volume of data ingestion may have significant electricity/compute cost implications. To be discussed with Satish.

---

*Last updated: April 17, 2026*