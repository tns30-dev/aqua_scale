# Sensor Service Checklist

## Target

| Item | Selection |
|---|---|
| Language | Java |
| Framework | Spring Boot |
| Database | Cloud SQL PostgreSQL |
| Cache | Redis/Memorystore for device-to-pond/port mapping |
| Public API | REST through API gateway |
| Internal API | gRPC |
| External integration | AWS IoT Core device metadata mirror |

## Responsibilities

| Status | Responsibility | Output |
|---|---|---|
| [ ] | Sensor type catalogue | Sensor model and measured parameters |
| [ ] | IoT device registry | Application-side device records |
| [ ] | Device status | Online/offline/maintenance status |
| [ ] | Project sensor mapping | Device/port/sensor mapped to project and pond |
| [ ] | Port-to-pond resolution | Ingestion lookup |
| [ ] | Device key/certificate metadata | Application validation metadata |
| [ ] | Parameter type relationship | Sensor measures parameter list |
| [ ] | AWS IoT thing mirror | Thing/certificate policy mapped to app device |

## Data Ownership

| Entity/Table | Purpose |
|---|---|
| `sensor_types` | Sensor model/catalogue |
| `iot_devices` | Device identity and application status |
| `project_sensors` | Project/pond/device/port mapping |
| `sensors` | Legacy or compatibility sensor records |
| `device_credentials_metadata` or equivalent | Certificate/key metadata, not raw private keys |

## REST API Checklist

| Status | Endpoint | Purpose |
|---|---|---|
| [ ] | `GET /api/sensor-types` | Sensor type catalogue |
| [ ] | `POST /api/sensor-types` | Create sensor type |
| [ ] | `GET /api/iot-devices` | List IoT devices |
| [ ] | `POST /api/iot-devices` | Register app device |
| [ ] | `PATCH /api/iot-devices/{deviceId}` | Update device status/config |
| [ ] | `GET /api/projects/{projectId}/sensors` | Project sensor mappings |
| [ ] | `POST /api/projects/{projectId}/sensors` | Add project sensor mapping |
| [ ] | `PATCH /api/project-sensors/{projectSensorId}` | Update mapping |

## gRPC Contract Checklist

| Status | RPC | Purpose |
|---|---|---|
| [ ] | `ResolveDevice` | Device lookup by device code/ID |
| [ ] | `ResolveDevicePort` | Map device and port to project/pond/projectSensor |
| [ ] | `GetDeviceValidationMetadata` | Signature/key metadata lookup |
| [ ] | `GetProjectSensor` | Mapping lookup |
| [ ] | `UpdateDeviceStatus` | Device status update if needed |

## Cache Checklist

| Status | Cache Entry | Invalidated By |
|---|---|---|
| [ ] | Device ID to project/pond mapping | Mapping update |
| [ ] | Device/port to projectSensor | Mapping update |
| [ ] | Device validation metadata | Credential/key rotation |
| [ ] | Sensor type catalogue | Sensor type update |

## Events

| Status | Event | Purpose |
|---|---|---|
| [ ] | `device.registered` | Audit and operations |
| [ ] | `device.status.changed` | Realtime status update |
| [ ] | `project.sensor.assigned` | Cache invalidation |
| [ ] | `project.sensor.updated` | Cache invalidation |
| [ ] | `audit.event.recorded` | Admin activity audit |

## Test Checklist

| Status | Test | Expected Result |
|---|---|---|
| [ ] | Register device | Device stored |
| [ ] | Add project sensor mapping | Mapping stored |
| [ ] | Resolve device/port by gRPC | Project/pond mapping returned |
| [ ] | Mapping cache hit | Redis lookup visible |
| [ ] | Unknown device lookup | Clear not-found response |

