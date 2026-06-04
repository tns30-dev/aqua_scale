# Class Diagram — Refinement Strategy

---

## The Problem

The current class diagram (`class_diagram_finalization/overall_class_diagram.md`) is essentially an **ERD with methods added**. Model classes have methods that reach across module boundaries — `Project.get_ponds()`, `Pond.get_sensors()`, `Pond.get_alerts()`. This makes everything look tightly coupled.

---

## The Fix

Keep it as **one class diagram** with 23 entity classes + 7 service classes. Two changes:

1. **Remove cross-module methods from model classes** — a model should only have methods about its own data
2. **Add service classes** — these handle the cross-module behavior and show WHERE business logic lives

---

## Methods REMOVED from model classes

| Class | Removed Method | Why |
|---|---|---|
| User | `get_projects_for_role()` | Traverses User → UserRole → UserRoleProject → Project. This is RBAC logic, not User data. |
| Project | `get_ponds()` | Reaches into Pond. Pond queries by project_id itself. |
| Project | `get_active_ponds()` | Same — reaches into Pond. |
| Project | `get_parameter_settings()` | Reaches into ProjectParameterSetting. Sensor module handles this. |
| Project | `get_key_parameters()` | Same — reaches into ProjectParameterSetting. |
| Project | `get_visualisations()` | Reaches into ProjectVisualisation. Chart module handles this. |
| Pond | `get_sensors()` | Reaches into ProjectSensor. Sensor module queries by pond_id. |
| Pond | `get_latest_reading()` | Reaches into SensorReading. Sensor/ingestion services handle this. |
| Pond | `get_alerts()` | Reaches into AlertLog. Notification module queries by pond_id. |
| SensorReading | `check_thresholds()` | Business logic — belongs in ThresholdService, not a data model. |
| SensorReading | `get_readings_for_pond()` | Query utility — belongs in SensorConfigService, not a data model. |

---

## Service classes ADDED

| Class | Key Methods |
|---|---|
| `AuthService` | `login(email, password) → Token`, `signup(email, password, name) → User`, `logout() → void` |
| `RBACService` | `get_user_projects(user_id) → List<Project>`, `has_project_access(user_id, project_id) → Boolean`, `has_feature_access(user_id, feature_code) → Boolean` |
| `SensorConfigService` | `load_project_sensor_map(device_id) → Dict`, `get_allowed_parameter_names(sensor_type_id) → Set<String>`, `pivot_readings(sensor_type_id, readings) → Dict`, `get_readings(pond_id, start_date, end_date) → List<SensorReading>` |
| `IngestionService` | `ingest(payload) → IngestResult` |
| `ThresholdService` | `check_and_broadcast(pond, project_id, readings, measured_at) → void` |
| `BroadcastService` | `broadcast_readings(pond_id, readings, timestamp) → void`, `broadcast_alerts(project_id, alerts) → void` |
| `ChartService` | `get_historical_chart_data(project_id, pond_id, start_date, end_date, grouping) → Dict` |

---

## Updated Class List (23 entities + 7 services + 1 dataclass = 31 classes)

| # | Class | Type | Attributes | Methods |
|---|---|---|---|---|
| 1 | User | Entity | user_id, email, password_hash, name, mobile_number, created_at, updated_at | get_full_name(), get_short_name(), set_password(), check_password(), has_role(role_type), update_profile() |
| 2 | Role | Entity | role_id, role_type, role_name, module_feature_assigned, created_at, created_by, updated_at, updated_by | has_module_access(module_code), has_feature_access(feature_code), get_modules(), get_features(), is_platform_admin() |
| 3 | UserRole | Entity | user_role_id, user_id, role_id, assigned_at, assigned_by | get_projects(), assign_project(project_id), remove_project(project_id) |
| 4 | UserRoleProject | Entity | user_role_project_id, user_role_id, project_id | — |
| 5 | ModuleAccess | Entity | module_access_id, name, code | — |
| 6 | FeatureAccess | Entity | feature_access_id, name, code | — |
| 7 | ProfileType | Entity | profile_type_id, code, name, description, stage_config, key_parameter_indicators, key_growth_indicators, created_at, created_by, updated_at, updated_by | get_stages(), get_stage_by_day(day_number), get_key_parameters(), get_key_growth_indicators(), get_cycle_length() |
| 8 | Project | Entity | project_id, project_owner_id, profile_type_id, name, description, created_at, created_by, updated_at, updated_by | get_profile_type(), get_owner() |
| 9 | Pond | Entity | pond_id, project_id, name, description, metadata, photo_url, status, created_at, updated_at | get_active_cycles(), get_current_cycle(), is_active() |
| 10 | Cycle | Entity | cycle_id, pond_id, start_date, end_date, status, created_at, created_by, updated_at, updated_by | current_day(), is_ongoing(), get_daily_health(), get_health_for_day(day), get_stage_metrics(), get_metrics_for_stage(stage_name), get_pond(), complete(), terminate() |
| 11 | CycleDailyHealth | Entity | health_id, cycle_id, day_number, date, health_status, alert_count, created_at | is_healthy(), has_alerts(), get_cycle() |
| 12 | CycleStageMetric | Entity | metric_id, cycle_id, stage_name, metrics, calculated_at | get_indicator_value(code), get_all_indicators(), get_cycle() |
| 13 | ParameterType | Entity | parameter_id, parameter_code, parameter_name, description, unit, data_type | get_display_name(), get_unit_label() |
| 14 | GrowthIndicator | Entity | growth_indicator_id, code, name, unit, data_type | get_display_name(), get_unit_label() |
| 15 | SensorType | Entity | sensor_type_id, name, description, model_number, manufacturer, parameter_ids, is_active, created_at, updated_at | get_parameters(), get_parameter_count(), can_measure(parameter_code) |
| 16 | IoTDevice | Entity | iot_device_id, device_code, device_name, status, config, is_active, device_key, created_at, updated_at | is_online(), get_assigned_sensors(), activate(), deactivate() |
| 17 | ProjectSensor | Entity | project_sensor_id, project_id, pond_id, sensor_type_id, iot_device_id, port, serial_number, status, installed_at, sensor_location, created_at, created_by, updated_at, updated_by | is_active(), get_sensor_type(), get_device(), get_measurable_parameters() |
| 18 | ProjectParameterSetting | Entity | project_id, parameter_id, min_threshold, max_threshold, is_key_parameter | is_within_threshold(value), get_violation_message(value), get_parameter() |
| 19 | SensorMessage | Entity | sensor_message_id, iot_device_id, seq_no, measured_at, received_at, transport_type, raw_message, created_at, created_by, updated_at, updated_by | get_device(), get_readings(), get_latency(), parse_raw_message() |
| 20 | SensorReading | Entity | sensor_reading_id, sensor_message_id, project_sensor_id, pond_id, temperature, salinity, ... (22 params), measured_at, received_at, created_at, created_by, updated_at, updated_by | get_value(parameter_code), get_non_null_parameters(), get_pond(), get_sensor() |
| 21 | VisualisationType | Entity | visualisation_type_id, name, description, required_parameters, chart_type | get_required_parameters(), get_chart_type() |
| 22 | ProjectVisualisation | Entity | project_visualisation_id, project_id, visualisation_type_id, enabled, flag, x_parameters, y_parameters, title | is_enabled(), get_x_parameters(), get_y_parameters(), get_visualisation_type(), get_project(), toggle_enabled() |
| 23 | AlertLog | Entity | log_id, pond_id, project_id, timestamp, log_type, message, severity, parameter, reading_timestamp, acknowledged, acknowledged_by, acknowledged_at, resolved, resolved_by, resolved_at | acknowledge(user_id), resolve(user_id), is_acknowledged(), is_resolved(), is_pending(), get_pond(), get_project() |
| 24 | AuthService | Service | — | login(email, password) → Token, signup(email, password, name) → User, logout() → void |
| 25 | RBACService | Service | — | get_user_projects(user_id) → List<Project>, has_project_access(user_id, project_id) → Boolean, has_feature_access(user_id, feature_code) → Boolean |
| 26 | SensorConfigService | Service | — | load_project_sensor_map(device_id) → Dict, get_allowed_parameter_names(sensor_type_id) → Set, pivot_readings(sensor_type_id, readings) → Dict, get_readings(pond_id, start, end) → List<SensorReading> |
| 27 | IngestionService | Service | — | ingest(payload) → IngestResult |
| 28 | ThresholdService | Service | — | check_and_broadcast(pond, project_id, readings, measured_at) → void |
| 29 | BroadcastService | Service | — | broadcast_readings(pond_id, readings, timestamp) → void, broadcast_alerts(project_id, alerts) → void |
| 30 | ChartService | Service | — | get_historical_chart_data(project_id, pond_id, start_date, end_date, grouping) → Dict, get_available_groupings(days) → Dict |
| 31 | IngestResult | Dataclass | status, iot_device_id, seq_no, sensor_message_id, rows_inserted | — |

---

## Updated Relationships (Primary Paths Only)

Only showing the relationships needed to understand how things work — not every FK in the database.

### Entity Relationships

```
                        ┌─── User & Access ───┐
User        "1" ──── "*" UserRole                           : has
Role        "1" ──── "*" UserRole                           : assigned to
UserRole    "1" ◆──── "*" UserRoleProject                   : has

                        ┌─── Project & Pond ──┐
ProfileType "1" ──── "*" Project                            : template for
User        "1" ──── "*" Project                            : owns
Project     "1" ◆──── "*" Pond                              : contains
Project     "1" ◆──── "*" ProjectParameterSetting           : configures thresholds
Project     "1" ◆──── "*" ProjectVisualisation              : configures charts

                        ┌─── Pond & Cycles ───┐
Pond        "1" ◆──── "*" Cycle                             : runs
Cycle       "1" ◆──── "*" CycleDailyHealth                  : tracks daily
Cycle       "1" ◆──── "*" CycleStageMetric                  : tracks stages

                        ┌─── Sensors & IoT ───┐
Pond        "1" ◇──── "*" ProjectSensor                     : has sensors installed
SensorType  "1" ──── "*" ProjectSensor                      : type of
IoTDevice   "1" ◇──── "*" ProjectSensor                     : connected via
ParameterType "1" ── "*" ProjectParameterSetting            : defines threshold for

                        ┌─── Data Pipeline ───┐
IoTDevice   "1" ◆──── "*" SensorMessage                     : sends
SensorMessage "1" ── "*" SensorReading                      : parsed into
ProjectSensor "1" ── "*" SensorReading                      : produced by

                        ┌─── Charts ──────────┐
VisualisationType "1" ── "*" ProjectVisualisation           : type of

                        ┌─── Alerts ──────────┐
Pond        "1" ──── "*" AlertLog                           : generates
User        "1" ──── "*" AlertLog                           : acknowledges
```

### Dependency (loose code-based references — not FK)

```
ModuleAccess    ···· Role               : JSONB codes reference
FeatureAccess   ···· Role               : JSONB codes reference
GrowthIndicator ···· ProfileType        : key_growth_indicators array
GrowthIndicator ···· CycleStageMetric   : metrics JSONB keys
```

### Service → Entity dependencies

```
AuthService         ···· User
RBACService         ···· UserRole, UserRoleProject
SensorConfigService ···· ProjectSensor, SensorType, ParameterType
IngestionService    ···· SensorMessage, SensorReading
ThresholdService    ···· ProjectParameterSetting, AlertLog
ChartService        ···· ProjectVisualisation, SensorReading
```

### What was REMOVED (denormalized shortcuts — exist in DB but not shown)

| Relationship | Why removed from diagram |
|---|---|
| Project → ProjectSensor | Redundant — go through Pond → ProjectSensor |
| Project → AlertLog | Redundant — go through Pond → AlertLog |
| Pond → SensorReading | Redundant — go through ProjectSensor → SensorReading |
| UserRoleProject → Project | Shown via RBAC service, not direct entity path |

---

## The Key Principle

**Models own their data. Services own the cross-cutting behavior.**

Before (tightly coupled):
```
Project.get_ponds()              → reaches into Pond
Project.get_parameter_settings() → reaches into ProjectParameterSetting
Pond.get_sensors()               → reaches into ProjectSensor
Pond.get_alerts()                → reaches into AlertLog
SensorReading.check_thresholds() → business logic on a data model
```

After (decoupled):
```
Project.get_profile_type()       → own data only
Pond.get_active_cycles()         → own data only (Cycle belongs to same group)
RBACService.get_user_projects()  → handles cross-entity traversal
ThresholdService.check_and_broadcast() → handles business logic
ChartService.get_historical_chart_data() → handles cross-entity query
```

---

*Last updated: April 27, 2026*