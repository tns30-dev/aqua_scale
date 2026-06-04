# Slack standup log — AquaShield Monitoring v2 + side projects

Source: `#aquashield` Slack channel, daily standups, captured 2026-05-20.
Team: Thet Naung Soe + Satish Chandrasekaran.

Used by:
- **3.md** (Project roadmap & key milestones) — for sprint-by-sprint progression
- **4.md** (Project backlog) — for the cumulative DID list / themes
- **5.md** (Sprint effort — estimate vs actual per member) — Thet vs Satish split

---

## Thet Naung Soe

- **Joined**: 2026 sprint window (joined `#aquashield` 10:28 AM)

### Bug fixes & frontend polish
- Fixed Historical Page tooltip clipping — replaced floating tooltip with an inline info bar (desktop hover + mobile tap)
- Fixed Historical Page losing pond selection on page refresh — aligned state management with other pages
- Fixed Acknowledge Alert API returning 500 (method mismatch: PUT → POST, missing trailing slash)
- Reduced login navigation delay from 1500ms to improve perceived response time

### BioBloc (new project alongside AquaShield)
- Learnt AquaShield v2 system architecture and codebase
- Mapped current implementation against use case diagram
- Attended kickoff meeting for "BioBloc" project
- Drafted potential software architecture for BioBloc (sensor hardware, Raspberry Pi, MQTT, MQTT Adapter, WebSocket pipeline)
- Drafted BioBloc architecture combined with AquaMonitoringv2
- Designed wireframe for BioBloc dashboard (real-time monitoring, historical data)
- Deployed interactive wireframe prototype for stakeholder review
- Prepared stakeholder-friendly presentation for unified platform architecture (subscription-based access model)
- Implemented wireframe v0.2 with Dashboard, A/B Comparison, Pond Detail, Treatment Efficiency, Financial Performance pages

### Cloud IoT research
- Visited Opal farm, gathered requirements
- Compared cloud IoT providers (AWS IoT Core vs Azure IoT Hub) — cost, MQTT protocol support, device management, architecture diagrams
- Started learning Raspberry Pi → AWS IoT Core (MQTT) and Azure IoT Hub

### Architecture & design artifacts
- Audited existing database schema, documented tables + relationships
- Identified areas for improvement in access control, growth cycle tracking, sensor management
- Prepared schema refinement proposal for RBAC, cycle stages, ponds
- Finalised ERD: User & Access Control, Profile Types, Projects, Ponds, Parameter Types, Growth Cycles, Sensors, IoT Devices, Visualisations, Alerts
- Compiled overall ERD diagram with all 23 tables, FK relationships, JSONB references
- Redrew sequence diagram
- Refined class diagram + architectural diagram
- Implemented overall architecture diagram and A/B activity diagram

### User Management module
- Learnt Django panel configuration and styling
- Implemented non-styling backend dashboard of user management
- Integrated styling and tested DB operations for backend dashboard of user management
- Implemented full User Management module — models (User, Role, UserRole, UserRoleProject, ModuleAccess, FeatureAccess), serializers, API endpoints, frontend UI
- Set up Django admin panel with Unfold styling for ModuleAccess + FeatureAccess management
- Changed user management implementation based on discussion (Part 2 simplification)
- Refining user management module further (Part 3)

### Pond Comparison feature
- Integrated pond comparison development with real sensor data
- Integrated pond comparison development with MQTT sensor
- Connected raspberry pi to local machine

---

## Satish Chandrasekaran

### MQTT pipeline development
- Tested MQTT Publisher → Broker message sending
- Tested MQTT Broker → Subscriber (Backend) message sending
- Tested validation errors for failed messages
- Created document to capture and explain message types
- Added logic to handle failed messages and data loss
- Fixed bugs on MQTT publisher (failed messages to broker)
- Started + continued working on sending readings to websocket
- Tested connecting 2 sensors → publish as batches
- Fixed websocket bugs (channel layer)

### Sensor procurement & deployment
- Visited Opal farm and got sensor deployment requirements
- Surveyed sensors to purchase
- Provided requirements to Accel vendor for sensors
- Met with sensor supplier
- Calibrated sensors with Research Team

### Bug fixes
- Fixed pond statuses showing warning when no sensor configured
- Fixed pond status not initialised when changing profile
- Fixed UI to show "No Readings" when no sensors configured
- Fixed alerts logs only saving for one sensor
- Fixed historical page charts to read from `sensor_readings` table

### Schema refinements
- Discussed database schema and changes with Thet
- Renamed `project_parameter_threshold` → `project_parameter_settings`; updated models + code
- Worked on logic changes for Multi-parameter Trends chart (dynamic x/y axis from `project_visualisation` table)
- Added time-range grouping (hourly, daily, weekly, monthly)
- Refactored x/y axis to dynamic config (Multi-Parameter Trends + Historical Trends)
- Refactored chart data source from partition table to `sensor_readings`
- Fixed Historical page time-range selection query

### Risk Assessment Tool (side project)
- Started development on Risk Assessment Tool
- Continued working on Risk Assessment Tool

### Raspberry Pi / data simulator
- Developed data_simulator on Pi, made the flow more realistic via MQTT
- Tested data simulator for all 3 profiles
- Connected raspberry pi to Thet's local to run simulator
- Built feature to store sensor data locally on Pi (for upcoming sensor deployment)
- Built battery-alert feature (email + WhatsApp on low threshold)
- Tested sensor data local-store + battery alert

### Datetime fixes
- Fixed datetime format storing for `sensor_readings`, `sensor_messages`
- Continued fixing datetime format for other tables
- (Pending) Fix datetime issue showing UTC time in the applications

### Azure deployment
- Researched Azure deployment
- Created Azure account, configured/purchased services
- Created provisioning script for Resource Group, VNet, Subnet, VM, Static IP, NSG, SSH, Auto-Shutdown
- Working on domain setup for VM1 (frontend)
- Started VM1 setup in Azure

### Meetings & planning
- Sprint Meeting + Sprint Planning with Thet
- Discussed Sprint Review comments with Thet

---

## Cross-cutting themes (for backlog/roadmap slides)

| Theme | Owner | Status |
|---|---|---|
| User Management module (Part 1 → Part 2 → Part 3) | Thet | Part 3 in flight, presentation focus |
| Pond Comparison feature | Thet | Shipped |
| Historical data refactor (chart logic + partition vs raw table) | Satish | Shipped |
| MQTT pipeline (publisher → broker → subscriber → websocket) | Satish | Shipped |
| Sensor deployment (procurement + calibration + Pi-local store) | Satish | In progress |
| Datetime timezone bug | Satish | Pending |
| Schema refinements (RBAC, cycles, parameter settings rename) | Both | Shipped |
| Cloud IoT research (AWS vs Azure) | Thet | Decision documented |
| Azure VM deployment (Resource Group → VM → Nginx) | Satish | Live (production) |
| BioBloc adjacent project (architecture, wireframes) | Thet | Concurrent work |
| Diagrams (ERD, class, architecture, sequence) | Thet | Shipped, multiple iterations |
| Bug fix sprint (tooltip clipping, login delay, alert API 500) | Thet | Shipped |
| Risk Assessment Tool (side project) | Satish | Concurrent work |

---

*Used by presentation slides 3, 4, 5. Not part of the main flow — reference only.*
