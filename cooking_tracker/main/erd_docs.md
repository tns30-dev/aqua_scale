# ERD Documentation

## Mermaid ERD

```mermaid
erDiagram
  USERS ||--o{ USER_PROJECT_ACCESS : has
  ROLE_TYPES ||--o{ USERS : assigns
  PROJECTS ||--o{ USER_PROJECT_ACCESS : grants
  PROFILE_TYPES ||--o{ PROJECTS : configures
  PROJECTS ||--o{ PONDS : owns
  PROJECTS ||--o{ PROJECT_PARAMETER_SETTINGS : defines
  PARAMETER_TYPES ||--o{ PROJECT_PARAMETER_SETTINGS : configures
  PONDS ||--o{ CYCLES : has
  CYCLES ||--o{ CYCLE_DAILY_HEALTH : records
  CYCLES ||--o{ CYCLE_STAGE_METRICS : summarizes
  SENSOR_TYPES ||--o{ PROJECT_SENSORS : categorizes
  IOT_DEVICES ||--o{ PROJECT_SENSORS : connects
  PROJECTS ||--o{ PROJECT_SENSORS : assigns
  PONDS ||--o{ PROJECT_SENSORS : installs
  IOT_DEVICES ||--o{ SENSOR_MESSAGES : publishes
  SENSOR_MESSAGES ||--o{ SENSOR_READINGS : parses
  PROJECT_SENSORS ||--o{ SENSOR_READINGS : produces
  PONDS ||--o{ SENSOR_READINGS : receives
  PONDS ||--o{ ALERTS : triggers
  PROJECTS ||--o{ ALERT_LOG : logs
  PONDS ||--o{ ALERT_LOG : logs
  VISUALISATION_TYPES ||--o{ PROJECT_VISUALISATIONS : defines
  PROJECTS ||--o{ PROJECT_VISUALISATIONS : enables
  USERS ||--o{ AUDIT_EVENTS : performs

  USERS {
    uuid user_id PK
    string email
    string password_hash
    string name
    string mobile_number
    uuid role_id FK
    timestamp created_at
  }

  ROLE_TYPES {
    uuid role_id PK
    string role_name
    json module_feature_assigned
    timestamp created_at
  }

  PROJECTS {
    uuid project_id PK
    uuid owner_user_id FK
    uuid profile_type_id FK
    string name
    string description
    timestamp created_at
  }

  PONDS {
    uuid pond_id PK
    uuid project_id FK
    string name
    string status
    json metadata
    string photo_url
  }

  PARAMETER_TYPES {
    uuid parameter_id PK
    string code
    string name
    string unit
    string data_type
  }

  PROJECT_PARAMETER_SETTINGS {
    uuid project_id FK
    uuid parameter_id FK
    decimal min_threshold
    decimal max_threshold
    boolean key_parameter_ind
  }

  IOT_DEVICES {
    uuid iot_device_id PK
    string device_code
    string device_name
    string status
    json config
    boolean is_active
  }

  PROJECT_SENSORS {
    uuid project_sensor_id PK
    uuid project_id FK
    uuid pond_id FK
    uuid sensor_type_id FK
    uuid iot_device_id FK
    string port
    string status
  }

  SENSOR_MESSAGES {
    uuid sensor_message_id PK
    uuid iot_device_id FK
    integer seq_no
    timestamp measured_at
    timestamp received_at
    json raw_message
  }

  SENSOR_READINGS {
    uuid sensor_reading_id PK
    uuid sensor_message_id FK
    uuid project_sensor_id FK
    uuid pond_id FK
    timestamp measured_at
    timestamp received_at
  }

  ALERTS {
    uuid alert_id PK
    uuid pond_id FK
    string parameter
    string severity
    decimal value
    boolean resolved
    timestamp created_at
  }

  AUDIT_EVENTS {
    uuid audit_id PK
    uuid actor_user_id FK
    string event_type
    string resource_type
    string resource_id
    string outcome
    string correlation_id
    timestamp occurred_at
  }
```

## Documentation Checklist

| Status | Item | Output |
|---|---|---|
| [ ] | Define service-owned schemas | Ownership map |
| [ ] | Define Identity tables | User/role/access ERD |
| [ ] | Define Project tables | Project/profile/parameter settings ERD |
| [ ] | Define Pond tables | Pond/cycle/health/stage metrics ERD |
| [ ] | Define Sensor tables | Device/sensor/mapping ERD |
| [ ] | Define Ingestion tables | Raw/parsed reading model or external store mapping |
| [ ] | Define Notification tables | Alerts and notification state ERD |
| [ ] | Define Audit tables | Append-only audit ERD |
| [ ] | Mark read-replica use cases | Read/write ownership notes |
| [ ] | Mark Bigtable/BigQuery external models | Non-relational store notes |

## Service Ownership Map

| Service | Owned Relational Data |
|---|---|
| Identity and Access | `users`, `role_types`, `user_project_access`, token state |
| Project | `projects`, `profile_types`, `parameter_types`, `project_parameter_settings`, optional visualisation config |
| Pond | `ponds`, `cycles`, `cycle_daily_health`, `cycle_stage_metrics`, optional treatments |
| Sensor | `sensor_types`, `iot_devices`, `project_sensors`, compatibility `sensors` |
| Ingestion | Parsed reading fallback tables, outbox if used |
| Notification | `alerts`, `alert_log`, notification request/delivery tables |
| Audit | `audit_events` |

