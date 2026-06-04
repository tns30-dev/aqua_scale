# Satish's Changes — Real Time Sensor Readings Development

> Commit: `d34f6e9` — "Real Time Sensor Readings Development"
> Date: April 22, 2026
> Files changed: 41 | +4,544 / -926 lines

---

## Summary

Satish implemented the **end-to-end MQTT-based real-time sensor data pipeline**: from Raspberry Pi → MQTT Broker → Django backend → WebSocket → Frontend dashboard.

---

## Backend Changes

### New Django Models Created (module_sensor/models.py)

| Model | Status | Notes |
|-------|--------|-------|
| `IoTDevice` | **NEW** | Maps to `iot_devices` table. Fields: device_code, device_name, status, config, device_key, is_active |
| `ProjectSensor` | **NEW** | Maps to `project_sensors` table. FKs to Project, Pond, SensorType, IoTDevice. Fields: port, serial_number, serial, status, installed_at, sensor_location |
| `SensorMessage` | **NEW** | Maps to `sensor_messages` table. FK to IoTDevice. Fields: seq_no, measured_at, received_at, transport_type, raw_message (JSONB) |
| `SensorReading` | **NEW** | Maps to `sensor_readings` table. All 22 parameter columns as FloatField. measured_at, received_at timestamps |
| `ProjectParameterSetting` | **Restructured** | Renamed from `ProjectParameterThreshold`. Added `is_key_parameter` boolean. Changed PK from composite to UUID. |
| `SensorType` | **Updated** | Added: manufacturer, description, is_active, created_at, updated_at |
| `Sensor` (legacy) | **Updated** | Added: iot_device FK, port, serial fields (but this model is still legacy) |

### New Services

| File | Purpose |
|------|---------|
| `module_data_ingestion/services.py` (530 lines) | **IngestionService** — validates MQTT payload, dedup check, inserts sensor_messages + sensor_readings, checks thresholds, creates alerts. **BroadcastService** — pushes readings + alerts to WebSocket channels |
| `module_sensor/services.py` (146 lines) | `load_project_sensor_map()` — maps IoT device ports to project sensors. `get_allowed_parameter_names()` — gets valid parameters for a sensor type. `pivot_readings()` — transforms raw MQTT readings into DB row format. `get_readings()` — queries sensor_readings with date filtering |

### New Constants

| File | Purpose |
|------|---------|
| `common/constants.py` | `SENSOR_READINGS_METADATA_COLS` — frozenset of non-sensor columns in sensor_readings table. Used to dynamically resolve which columns are sensor parameters vs metadata |

### New MQTT Infrastructure

| File | Purpose |
|------|---------|
| `module_sensor/management/commands/mqtt_adapter.py` | Django management command that subscribes to MQTT topics, validates device auth (HMAC), and calls IngestionService |
| `mqtt/mosquitto.conf` | Mosquitto broker config |
| `mqtt/acl` | MQTT access control list |
| `mqtt/certs/server.cnf` | TLS certificate config |

### Modified Views & URLs

| File | Change |
|------|--------|
| `module_project/views.py` | Updated to use `SensorReading` model for fetching readings instead of raw SQL partition queries |
| `module_project/urls.py` | Removed 23 lines — cleaned up URL patterns |
| `module_project/consumers.py` | Refactored `PondConsumer` — now uses `SENSOR_READINGS_METADATA_COLS` constant to dynamically build parameter list from sensor_readings columns |
| `module_data_ingestion/consumers.py` | Minor updates to IngestConsumer |
| `module_sensor/serializers.py` | Added `SensorIngestSerializer` for validating MQTT payloads |
| `module_sensor/admin.py` | Minor admin registration updates |

### SQL Migration

| File | Changes |
|------|---------|
| `sql/SPRINT 4.sql` (313 lines) | ALTER sensor_types (add manufacturer, description, is_active, timestamps). CREATE iot_devices table. CREATE project_sensors table. CREATE sensor_messages table. Rename project_parameter_thresholds → project_parameter_settings + add is_key_parameter. CREATE project_parameter_settings if not exists |

---

## Frontend Changes

| File | Change |
|------|--------|
| `HistoricalTrendsAnalysis.tsx` | Major refactor — now fetches chart data from `sensor_readings` table via API instead of partition tables |
| `api.service.ts` | Updated API calls — new endpoints for sensor readings |
| `websocket.service.ts` | Updated WebSocket handling for new real-time data format |
| `useGlobalWebSocket.ts` | Updated hook for new WebSocket message format |
| `PondCircle.tsx` / `PondGrid.tsx` | Minor updates for real-time reading display |
| `OverviewPage.tsx` / `ForecastPage.tsx` / `HistoricalDataPage.tsx` | Updated to work with new data format |
| `pondStore.ts` | Removed 19 lines — cleaned up store |
| `types/index.ts` | Minor type changes |
| `pondStatusCalculator.ts` | Minor status calculation update |

---

## Documentation Added

| File | Content |
|------|---------|
| `docs/setup/MQTT Guide.md` | 302 lines — MQTT setup and usage guide |
| `docs/setup/MQTT Raspberry Pi Setup Guide.md` | 586 lines — Pi hardware setup |
| `docs/setup/MQTT TLS Configuration Guide.md` | 337 lines — TLS/SSL config |
| `docs/setup/Production Environment Configuration Guide.md` | 369 lines — Production deployment |

---

## Key Architecture Decisions

1. **Data flow**: Raspberry Pi → MQTT Broker (Mosquitto) → `mqtt_adapter` command → `IngestionService` → DB + WebSocket broadcast
2. **Dedup check**: Uses `iot_device_id + seq_no` to prevent duplicate message processing
3. **Dynamic parameter resolution**: Uses `SENSOR_READINGS_METADATA_COLS` constant to figure out which columns are sensor parameters — no hardcoding of parameter names
4. **Port-based sensor mapping**: MQTT payload includes port info, mapped to project_sensor via `load_project_sensor_map()`
5. **Historical data**: `module_project/views.py` now reads from `sensor_readings` table directly (was using partition tables before)

---

## Impact on Our ERD/Class Diagram

| Our ERD Table | Satish's Implementation | Aligned? |
|---|---|---|
| `iot_devices` | Created `IoTDevice` model | Yes |
| `project_sensors` | Created `ProjectSensor` model | Yes |
| `sensor_messages` | Created `SensorMessage` model | Yes |
| `sensor_readings` | Created `SensorReading` model | Yes |
| `project_parameter_settings` | Renamed + added `is_key_parameter` | Yes |
| `sensor_types` | Added missing columns | Yes |
| `sensors` (legacy) | Still exists — not dropped yet | Pending |
| `growth_indicators` | Not implemented | Pending |
| `roles` (new RBAC) | Not implemented | Pending |
| `user_roles` / `user_role_projects` | Not implemented | Pending |

---

*Last reviewed: April 23, 2026*
