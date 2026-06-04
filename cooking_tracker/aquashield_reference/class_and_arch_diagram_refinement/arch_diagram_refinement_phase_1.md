# Architecture Diagram — Refined (Phase 1)

> Paste the Mermaid blocks into [mermaid.live](https://mermaid.live) to render.
> This diagram reflects the 7-module backend structure from `arch_diagram_refinement.md`.

---

## What Changed From the Previous Diagram

| Area | Before | After |
|---|---|---|
| Project Module | 1 big module (Project, Pond, Cycle, DailyHealth, StageMetric, ProfileType) | Split into **Project Module** (Project, ProfileType) + **Pond Module** (Pond, Cycle, DailyHealth, StageMetric) |
| Sensor Management Module | Mixed config + data (8 models) | **Sensor Module** = config only (ParameterType, SensorType, IoTDevice, ProjectSensor, ProjectParameterSetting, GrowthIndicator) |
| Data Ingestion Module | Legacy partition tables + old WebSocket IngestConsumer | Repurposed: **IngestionService** + **ThresholdService** + **BroadcastService** (SensorMessage, SensorReading) |
| WebSocket Broadcaster | Standalone box in diagram | Now lives inside **Data Ingestion Module** as BroadcastService |
| MQTT Service | Separate box | Now **mqtt_adapter** management command inside Sensor Module, calls IngestionService |
| Chart Module | Services only, no entity ownership | Now owns **VisualisationType** + **ProjectVisualisation** |
| User Module | 2 models (User, old Role) | 6 models (User, Role, UserRole, UserRoleProject, ModuleAccess, FeatureAccess) |
| Frontend pages | 6 pages (Login, Overview, Digital Twin, Real-time, Historical, Pond Comparison) | **9 pages** — added Project Management, Sensor Management, User Management |

---

## Frontend Pages (9 total)

| Page | What it covers | Backend modules used |
|---|---|---|
| Login | Authentication | User Module |
| Overview | Dashboard, pond status, alerts | Project, Pond, Notification |
| Digital Twin | 3D pond view, live parameters | Pond, Data Ingestion (WebSocket) |
| Real-time & Forecast | Live charts, predictions | Pond, Data Ingestion (WebSocket) |
| Historical Data | Charts, cycles, health timeline | Pond, Chart, Sensor |
| Pond Comparison | Compare ponds side by side | Pond, Sensor |
| Project Management | Projects, ponds, threshold configuration | Project, Pond, Sensor (thresholds) |
| Sensor Management | IoT devices, sensors, port mapping, parameter types | Sensor |
| User Management | Users, roles, project access assignment | User |

---

## 1. Full Architecture Diagram

```mermaid
graph TB
    %% =====================================================================
    %% FRONTEND LAYER
    %% =====================================================================
    subgraph Frontend["Frontend (React + TypeScript + Vite)"]
        direction TB
        AppRouting["App Routing"]

        subgraph Pages["Pages"]
            direction LR
            LoginPage["Login"]
            OverviewPage["Overview"]
            DigitalTwinPage["Digital Twin"]
            RealTimePage["Real-time &\nForecast"]
            HistoricalPage["Historical\nData"]
            PondComparisonPage["Pond\nComparison"]
            ProjectMgmtPage["Project\nManagement"]
            SensorMgmtPage["Sensor\nManagement"]
            UserMgmtPage["User\nManagement"]
        end

        AppRouting --> LoginPage
        AppRouting --> OverviewPage
        AppRouting --> DigitalTwinPage
        AppRouting --> RealTimePage
        AppRouting --> HistoricalPage
        AppRouting --> PondComparisonPage
        AppRouting --> ProjectMgmtPage
        AppRouting --> SensorMgmtPage
        AppRouting --> UserMgmtPage
    end

    %% User
    User(("Users"))
    User -->|"user navigation"| AppRouting

    %% =====================================================================
    %% FRONTEND TO BACKEND CONNECTIONS
    %% =====================================================================

    LoginPage -->|"send login credentials\n& authenticate users"| RESTAPI
    OverviewPage -->|"request & receive\nproject, pond, alert data"| RESTAPI
    DigitalTwinPage -->|"request & receive\npond, sensor readings"| RESTAPI
    RealTimePage -->|"request & receive\nproject, pond, alert data"| RESTAPI
    HistoricalPage -->|"request & receive\nproject, pond, visualization,\ncycle data"| RESTAPI
    PondComparisonPage -->|"request & receive\npond, treatment &\ncomparison data"| RESTAPI
    ProjectMgmtPage -->|"CRUD projects, ponds,\nthreshold configuration"| RESTAPI
    SensorMgmtPage -->|"CRUD IoT devices, sensors,\nport mapping, parameter types"| RESTAPI
    UserMgmtPage -->|"CRUD users, roles,\nproject access assignment"| RESTAPI

    %% WebSocket connections
    OverviewPage <-->|"receives real-time\nalert updates"| BroadcastSvc
    DigitalTwinPage <-->|"receives real-time\nsensor updates"| BroadcastSvc
    RealTimePage <-->|"receives real-time\nsensor updates"| BroadcastSvc

    %% =====================================================================
    %% BACKEND LAYER
    %% =====================================================================
    subgraph Backend["Backend (Django + Django Channels + Daphne)"]
        direction TB

        RESTAPI["REST API\n(HTTPS Endpoints)"]

        subgraph BackendModules["Backend Modules"]
            direction TB

            subgraph Row1[" "]
                direction LR
                UserModule["User Module\n───────────\nUser, Role\nUserRole\nUserRoleProject\nModuleAccess\nFeatureAccess"]
                ProjectModule["Project Module\n───────────\nProfileType\nProject"]
                PondModule["Pond Module\n───────────\nPond\nCycle\nCycleDailyHealth\nCycleStageMetric"]
            end

            subgraph Row2[" "]
                direction LR
                NotificationModule["Notification Module\n───────────\nAlertLog"]
                ChartModule["Chart Module\n───────────\nVisualisationType\nProjectVisualisation\n+ ChartService"]
            end

            subgraph Row3[" "]
                direction LR
                SensorModule["Sensor Module\n───────────\nParameterType\nGrowthIndicator\nSensorType\nIoTDevice\nProjectSensor\nProjectParameterSetting"]
                DataIngestionModule["Data Ingestion Module\n───────────\nSensorMessage\nSensorReading\n+ IngestionService\n+ ThresholdService"]
            end

            BroadcastSvc["WebSocket Broadcaster\n(BroadcastService)\n───────────\nPondConsumer\nProjectConsumer"]
        end

        RESTAPI --> UserModule
        RESTAPI --> ProjectModule
        RESTAPI --> PondModule
        RESTAPI --> NotificationModule
        RESTAPI --> ChartModule
        RESTAPI --> SensorModule
    end

    %% =====================================================================
    %% INTER-MODULE CONNECTIONS (Backend)
    %% =====================================================================

    DataIngestionModule -->|"creates alerts on\nthreshold violation"| NotificationModule
    DataIngestionModule -->|"broadcasts readings\n& alerts via WebSocket"| BroadcastSvc
    DataIngestionModule -->|"reads sensor config,\nport mapping, thresholds"| SensorModule

    ChartModule -->|"queries sensor_readings\nvia get_readings()"| SensorModule
    ChartModule -->|"reads project\nvisualisation config"| ProjectModule

    PondModule -->|"pond.project_id"| ProjectModule

    NotificationModule -->|"alert_log references\npond & project"| PondModule

    %% =====================================================================
    %% DATABASE
    %% =====================================================================
    subgraph DatabaseLayer["Database"]
        DB[("Aquaculture\n(PostgreSQL)")]
    end

    UserModule -->|"fetch user data"| DB
    ProjectModule -->|"fetch project &\nprofile type data"| DB
    PondModule -->|"fetch pond &\ncycle data"| DB
    NotificationModule -->|"fetch & store\nalert data"| DB
    ChartModule -->|"fetch visualization\nconfig"| DB
    SensorModule -->|"fetch sensor &\nIoT device config"| DB
    DataIngestionModule -->|"store sensor_messages\n& sensor_readings"| DB

    %% =====================================================================
    %% MQTT LAYER
    %% =====================================================================
    subgraph MQTTLayer["MQTT"]
        MQTTBroker["MQTT Broker\n(Mosquitto)"]
    end

    MQTTAdapter["MQTT Adapter\n(mqtt_adapter command)\n───────────\nSubscribes to broker\nValidates HMAC\nCalls IngestionService"]

    MQTTBroker -->|"publish subscribed\nmessage"| MQTTAdapter
    MQTTAdapter -->|"validated payload\nIngestionService.ingest()"| DataIngestionModule

    %% =====================================================================
    %% IoT LAYER
    %% =====================================================================
    subgraph IoTLayer["IoT Agent"]
        RaspberryPi["Raspberry Pi\nPython Service Agent"]
    end

    WaterSensors(("Water\nSensors"))
    WaterSensors -->|"raw sensor data"| RaspberryPi
    RaspberryPi -->|"publish sensor data\nas MQTT message"| MQTTBroker
```

---

## 2. Data Flow Diagram (Write Path)

Shows the MQTT ingestion pipeline — from sensor to dashboard.

```mermaid
graph LR
    subgraph IoT["IoT Layer"]
        Sensors["Water Sensors"]
        RPi["Raspberry Pi"]
    end

    subgraph MQTT["MQTT Layer"]
        Broker["Mosquitto\nBroker"]
        Adapter["mqtt_adapter"]
    end

    subgraph Ingestion["Data Ingestion Module"]
        IS["IngestionService"]
        TS["ThresholdService"]
        BS["BroadcastService"]
    end

    subgraph Storage["Database"]
        SM["sensor_messages"]
        SR["sensor_readings"]
        AL["alert_log"]
    end

    subgraph Consumers["WebSocket Consumers"]
        PC["PondConsumer"]
        PrC["ProjectConsumer"]
    end

    FE["Frontend\n(Browser)"]

    Sensors --> RPi
    RPi -->|"MQTT publish"| Broker
    Broker -->|"subscribe"| Adapter
    Adapter -->|"ingest()"| IS
    IS -->|"store raw"| SM
    IS -->|"store parsed"| SR
    IS -->|"after commit"| TS
    TS -->|"violation?"| AL
    TS --> BS
    BS -->|"sensor.reading"| PC
    BS -->|"alert.message"| PrC
    PC -->|"WebSocket"| FE
    PrC -->|"WebSocket"| FE
```

---

## 3. Data Flow Diagram (Read Path)

Shows how the frontend gets historical chart data.

```mermaid
graph LR
    FE["Frontend\nHistorical Data Page"]
    API["REST API\nGET /api/projects/{id}/charts/"]
    PV["ProjectViewSet\n.charts()"]
    CS["ChartService\n.get_historical_chart_data()"]
    GR["get_readings()\nmodule_sensor/services.py"]
    SR[("sensor_readings\ntable")]
    PVis[("project_visualisations\ntable")]

    FE -->|"HTTP GET"| API
    API --> PV
    PV --> CS
    CS -->|"which charts\nare enabled?"| PVis
    CS -->|"query readings\nfor date range"| GR
    GR --> SR
    SR -->|"namedtuples"| GR
    GR -->|"raw readings"| CS
    CS -->|"8 chart datasets"| PV
    PV -->|"JSON response"| FE
```

---

## 4. Module Boundary Diagram

Shows all 23 models across 7 modules with FK relationships.

```mermaid
graph TB
    subgraph UM["module_user (6 models)"]
        U1["User"]
        U2["Role"]
        U3["UserRole"]
        U4["UserRoleProject"]
        U5["ModuleAccess"]
        U6["FeatureAccess"]
    end

    subgraph PM["module_project (2 models)"]
        P1["ProfileType"]
        P2["Project"]
    end

    subgraph PDM["module_pond (4 models)"]
        PD1["Pond"]
        PD2["Cycle"]
        PD3["CycleDailyHealth"]
        PD4["CycleStageMetric"]
    end

    subgraph SM["module_sensor (6 models)"]
        S1["ParameterType"]
        S2["GrowthIndicator"]
        S3["SensorType"]
        S4["IoTDevice"]
        S5["ProjectSensor"]
        S6["ProjectParameterSetting"]
    end

    subgraph DIM["module_data_ingestion (2 models)"]
        D1["SensorMessage"]
        D2["SensorReading"]
    end

    subgraph CM["module_chart (2 models)"]
        C1["VisualisationType"]
        C2["ProjectVisualisation"]
    end

    subgraph NM["module_notification (1 model)"]
        N1["AlertLog"]
    end

    %% User & Access
    U1 --- U3
    U2 --- U3
    U3 --- U4
    U4 --- P2

    %% Project & Pond
    P1 -->|"profile_type_id"| P2
    P2 -->|"project_id"| PD1
    PD1 -->|"pond_id"| PD2
    PD2 -->|"cycle_id"| PD3
    PD2 -->|"cycle_id"| PD4

    %% Sensor config
    P2 -->|"project_id"| S5
    PD1 -->|"pond_id"| S5
    S3 -->|"sensor_type_id"| S5
    S4 -->|"iot_device_id"| S5
    P2 -->|"project_id"| S6
    S1 -->|"parameter_id"| S6

    %% Data ingestion
    S4 -->|"iot_device_id"| D1
    D1 -->|"sensor_message_id"| D2
    S5 -->|"project_sensor_id"| D2
    PD1 -->|"pond_id"| D2

    %% Chart
    P2 -->|"project_id"| C2
    C1 -->|"visualisation_type_id"| C2

    %% Alerts
    PD1 -->|"pond_id"| N1
    P2 -->|"project_id"| N1
```

---

## 5. Page-to-Module Mapping

Shows which backend modules each frontend page depends on.

```mermaid
graph LR
    subgraph Pages["Frontend Pages"]
        P1["Login"]
        P2["Overview"]
        P3["Digital Twin"]
        P4["Real-time & Forecast"]
        P5["Historical Data"]
        P6["Pond Comparison"]
        P7["Project Management"]
        P8["Sensor Management"]
        P9["User Management"]
    end

    subgraph Modules["Backend Modules"]
        M1["User Module"]
        M2["Project Module"]
        M3["Pond Module"]
        M4["Sensor Module"]
        M5["Data Ingestion Module"]
        M6["Chart Module"]
        M7["Notification Module"]
    end

    P1 --> M1
    P2 --> M2
    P2 --> M3
    P2 --> M7
    P3 --> M3
    P3 --> M5
    P4 --> M3
    P4 --> M5
    P5 --> M3
    P5 --> M6
    P5 --> M4
    P6 --> M3
    P6 --> M4
    P7 --> M2
    P7 --> M3
    P7 --> M4
    P8 --> M4
    P9 --> M1
```

---

*Last updated: April 27, 2026*