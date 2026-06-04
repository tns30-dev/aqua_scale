# Sensor Data — Class Diagram

---

## Current State (what exists)

- `SensorMessage` — **no Django model**, raw SQL table only
- `SensorReading` — **no Django model**, raw SQL table only
- Data ingestion happens via `IngestConsumer` (WebSocket) → `PartitionManager` → writes directly to partition tables via raw SQL

---

## Refined Class Diagram (2 classes)

### 1. SensorMessage

```
┌──────────────────────────────────────────────┐
│             SensorMessage                    │
├──────────────────────────────────────────────┤
│ - sensor_message_id: UUID                    │
│ - iot_device_id: UUID                        │
│ - seq_no: Integer                            │
│ - measured_at: Timestamp                     │
│ - received_at: Timestamp                     │
│ - transport_type: String                     │
│ - raw_message: JSONB                         │
│ - created_at: Timestamp                      │
│ - created_by: UUID                           │
│ - updated_at: Timestamp                      │
│ - updated_by: UUID                           │
├──────────────────────────────────────────────┤
│ + get_device(): IotDevice                    │
│ + get_readings(): List<SensorReading>        │
│ + get_latency(): Duration                    │
│ + parse_raw_message(): Dict                  │
└──────────────────────────────────────────────┘
```

**Methods:**
- `get_device()` — returns the IoT device that sent this message
- `get_readings()` — returns all parsed sensor readings created from this message
- `get_latency()` — calculates `received_at - measured_at` (network delay)
- `parse_raw_message()` — extracts parameter values from `raw_message` JSONB

---

### 2. SensorReading

```
┌──────────────────────────────────────────────┐
│             SensorReading                    │
├──────────────────────────────────────────────┤
│ - sensor_reading_id: UUID                    │
│ - sensor_message_id: UUID                    │
│ - project_sensor_id: UUID                    │
│ - pond_id: UUID                              │
│ - temperature: Decimal                       │
│ - salinity: Decimal                          │
│ - ... (22 parameter columns): Decimal        │
│ - measured_at: Timestamp                     │
│ - received_at: Timestamp                     │
│ - created_at: Timestamp                      │
│ - created_by: UUID                           │
│ - updated_at: Timestamp                      │
│ - updated_by: UUID                           │
├──────────────────────────────────────────────┤
│ + get_value(parameter_code: String): Decimal │
│ + get_non_null_parameters(): Dict            │
│ + check_thresholds(settings: List<ProjectParameterSetting>): List<Alert>│
│ + get_pond(): Pond                           │
│ + get_sensor(): ProjectSensor                │
│ + get_readings_for_pond(pond_id: UUID, start: Date, end: Date): List<SensorReading>  «static»│
└──────────────────────────────────────────────┘
```

**Methods:**
- `get_value(parameter_code)` — returns the value of a specific parameter column (e.g., `get_value('temperature')` returns `self.temperature`)
- `get_non_null_parameters()` — returns dict of only parameters that have values (not all 22 will be populated per reading)
- `check_thresholds(settings)` — compares reading values against project parameter settings, returns list of threshold violations (powers the alert system)
- `get_pond()` — returns the pond this reading belongs to
- `get_sensor()` — returns the project sensor that produced this reading

---

## Relationships

```
IotDevice "1" ◆──── "*" SensorMessage        : sends         (Composition)
SensorMessage "1" ── "*" SensorReading        : parsed into   (Association)
ProjectSensor "1" ── "*" SensorReading        : produced by   (Association)
Pond "1" ──────────── "*" SensorReading        : belongs to    (Association)
```

### Why these relationship types?

| Relationship | Type | Why |
|---|---|---|
| IotDevice → SensorMessage | **Composition** ◆ | Raw messages belong to the device. Delete device = messages gone (CASCADE). A message is meaningless without its source device. |
| SensorMessage → SensorReading | **Association** | One message is parsed into 1-N readings. But readings have independent value — they're the "clean" data used by the whole app. Readings should survive even if we archive/delete old messages. |
| ProjectSensor → SensorReading | **Association** | Readings reference which sensor produced them. Sensor uses RESTRICT — readings protect the sensor from deletion. |
| Pond → SensorReading | **Association** | Readings reference which pond they belong to. RESTRICT — can't delete a pond with readings. |

---

## Data Flow

```
1. IoT Device sends raw JSON via WebSocket
       ↓
2. IngestConsumer receives and validates
       ↓
3. SensorMessage created (stores raw_message JSONB)
       ↓
4. Raw message parsed → SensorReading created (22 parameter columns)
       ↓
5. SensorReading.check_thresholds() → creates AlertLog if violated
       ↓
6. Broadcast to frontend via WebSocket
```

---

## Notes

- Both are **new Django models needed** (currently raw SQL + `PartitionManager`)
- `SensorMessage → SensorReading` is **Association** (not Composition) — this is intentional. Readings are the core data asset. You might want to archive old messages but keep readings forever.
- `SensorReading` has 22 hardcoded parameter columns — if new parameters are added, a schema migration is needed (discussed JSONB alternative with Satish)

---

*Last updated: April 20, 2026*