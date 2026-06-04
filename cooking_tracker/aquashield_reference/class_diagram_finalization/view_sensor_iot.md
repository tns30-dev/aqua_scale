# Sensors & IoT — Class Diagram

---

## Current State (what exists)

- `SensorType` model — exists, has `get_parameters()` method
- `Sensor` model — exists but **legacy, to be dropped** (replaced by ProjectSensor)
- `IotDevice` — **no Django model**, raw SQL table only
- `ProjectSensor` — **no Django model**, raw SQL table only

---

## Refined Class Diagram (3 classes)

### 1. SensorType

```
┌──────────────────────────────────────────────┐
│              SensorType                      │
├──────────────────────────────────────────────┤
│ - sensor_type_id: UUID                       │
│ - name: String                               │
│ - description: String                        │
│ - model_number: String                       │
│ - manufacturer: String                       │
│ - parameter_ids: UUID[]                      │
│ - is_active: Boolean                         │
│ - created_at: Timestamp                      │
│ - updated_at: Timestamp                      │
├──────────────────────────────────────────────┤
│ + get_parameters(): List<ParameterType>      │
│ + get_parameter_count(): int                 │
│ + can_measure(parameter_code: String): Boolean│
└──────────────────────────────────────────────┘
```

**Methods:**
- `get_parameters()` — already exists, queries ParameterType by UUIDs in `parameter_ids` array
- `get_parameter_count()` — returns length of `parameter_ids`
- `can_measure(parameter_code)` — checks if a specific parameter is in this sensor's capabilities

---

### 2. IotDevice

```
┌──────────────────────────────────────────────┐
│               IotDevice                      │
├──────────────────────────────────────────────┤
│ - iot_device_id: UUID                        │
│ - device_code: String                        │
│ - device_name: String                        │
│ - status: String                             │
│ - config: JSONB                              │
│ - is_active: Boolean                         │
│ - device_key: String                         │
│ - created_at: Timestamp                      │
│ - updated_at: Timestamp                      │
├──────────────────────────────────────────────┤
│ + is_online(): Boolean                       │
│ + get_assigned_sensors(): List<ProjectSensor>│
│ + get_messages(limit: int): List<SensorMessage>│
│ + activate(): void                           │
│ + deactivate(): void                         │
└──────────────────────────────────────────────┘
```

**Methods:**
- `is_online()` — checks if `status == 'online'`
- `get_assigned_sensors()` — returns project sensors using this device
- `get_messages(limit)` — returns recent raw messages from this device
- `activate()` / `deactivate()` — sets `is_active` flag

---

### 3. ProjectSensor

```
┌──────────────────────────────────────────────┐
│             ProjectSensor                    │
├──────────────────────────────────────────────┤
│ - project_sensor_id: UUID                    │
│ - project_id: UUID                           │
│ - pond_id: UUID                              │
│ - sensor_type_id: UUID                       │
│ - iot_device_id: UUID                        │
│ - port: String                               │
│ - serial_number: String                      │
│ - status: String                             │
│ - installed_at: Date                         │
│ - sensor_location: Point                     │
│ - created_at: Timestamp                      │
│ - created_by: UUID                           │
│ - updated_at: Timestamp                      │
│ - updated_by: UUID                           │
├──────────────────────────────────────────────┤
│ + is_active(): Boolean                       │
│ + get_readings(limit: int): List<SensorReading>│
│ + get_sensor_type(): SensorType              │
│ + get_device(): IotDevice                    │
│ + get_measurable_parameters(): List<ParameterType>│
└──────────────────────────────────────────────┘
```

**Methods:**
- `is_active()` — checks if `status == 'active'`
- `get_readings(limit)` — returns recent sensor readings from this sensor
- `get_sensor_type()` — returns the associated sensor type
- `get_device()` — returns the assigned IoT device
- `get_measurable_parameters()` — shortcut: calls `sensor_type.get_parameters()`

---

## Relationships

```
SensorType "1" ──────── "*" ProjectSensor       : type of       (Association)
IotDevice "1" ◇──────── "*" ProjectSensor       : assigned to   (Aggregation)
Project "1" ◆──────── "*" ProjectSensor         : has           (Composition)
Pond "1" ────────────── "*" ProjectSensor        : located in    (Association)
IotDevice "1" ◆──────── "*" SensorMessage        : sends         (Composition)
ProjectSensor "1" ────── "*" SensorReading       : produced by   (Association)
```

### Why these relationship types?

| Relationship | Type | Why |
|---|---|---|
| SensorType → ProjectSensor | **Association** | Sensor type is a reference/catalog. It defines what the sensor is, but doesn't own instances. |
| IotDevice → ProjectSensor | **Aggregation** ◇ | Device is assigned to sensors but exists independently. You can unassign a device (SET NULL) without deleting the sensor record. The hollow diamond means "has, but doesn't own". |
| Project → ProjectSensor | **Composition** ◆ | Sensor assignment belongs to a project. Delete project = sensor assignments gone. |
| Pond → ProjectSensor | **Association** | Pond is referenced but sensor can potentially be reassigned to another pond. |
| IotDevice → SensorMessage | **Composition** ◆ | Messages are meaningless without their source device. Delete device = messages gone (CASCADE). |
| ProjectSensor → SensorReading | **Association** | Readings reference which sensor produced them, but readings have historical value even if sensor is decommissioned (RESTRICT). |

---

## Dropped Class

### Sensor (legacy)

```
┌──────────────────────────┐
│     Sensor  «DROPPED»    │
├──────────────────────────┤
│ Replaced by ProjectSensor│
└──────────────────────────┘
```

---

## Notes

- `IotDevice` and `ProjectSensor` — **new Django models needed** (currently raw SQL only)
- `Sensor` model — **to be dropped** (replaced by `ProjectSensor`)
- `IotDevice → ProjectSensor` is **Aggregation** (not Composition) because `iot_device_id` is `ON DELETE SET NULL` — the device can be unassigned without destroying the sensor record
- `SensorType.parameter_ids` is a UUID array referencing `ParameterType` — no FK enforcement, just convention

---

*Last updated: April 20, 2026*