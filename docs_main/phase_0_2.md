# Product/Platform Backlog

The AquaShield product backlog was organized around the main capabilities required for an aquaculture decision-support platform. The backlog focuses on the business and user needs of farmers, researchers, aquaculture product developers, business owners, and platform administrators. The user stories show how the platform supports daily pond operations, product-effectiveness validation, treatment tracking, alerting, reporting, and planned decision intelligence.

## Product Backlog Epics and User Stories

### 1. Authentication and User Management

1. As a platform user, I want to sign in and sign out securely so that my account and farm data are protected.
2. As a platform user, I want to view and update my own profile so that my contact details and account information remain current.
3. As a platform administrator, I want to onboard new users with appropriate access rights so that each user can start with the correct responsibilities.
4. As a platform administrator, I want to deactivate a user without deleting history so that the platform preserves accountability and operational records.

### 2. Project and Profile Configuration

1. As a platform administrator, I want to create projects and assign project owners so that the platform can support multiple farms, customers, or research sites.
2. As a platform administrator, I want to define farm profile types such as shrimp, fish, crab hatchery, and product-specific profiles so that each project can follow the correct farming model.
3. As a platform administrator, I want to configure water-quality parameters and safe ranges so that monitoring and alerts match the needs of each farm profile.
4. As a business owner, I want configurable project and profile settings so that the platform can support different customers without redesigning the product for each farm.

### 3. Pond Operations

1. As a farm manager, I want to view all ponds under a project so that I can understand the overall farm condition at a glance.
2. As a farm manager, I want to view the current health status of each pond so that I can prioritize operational action.
3. As a farm manager, I want to manage pond details such as location, image, profile, and operating status so that each pond is clearly identified.
4. As a researcher, I want pond information to be connected with readings and treatments so that later analysis has the correct operational context.

### 4. Cycle and Growth Management

1. As a farm manager, I want to start and manage a growth cycle for a pond so that readings and observations are linked to the correct farming period.
2. As a farm manager, I want to record daily health observations so that the platform keeps a history of pond condition during each cycle.
3. As a farm manager, I want to track cycle stages such as juvenile, grow-out, and pre-harvest so that the pond status reflects the real production stage.
4. As a researcher, I want to review cycle-level health history so that product performance can be compared across different farming periods.

### 5. Sensor and Device Management

1. As a system administrator, I want to register sensors and devices so that incoming readings are accepted only from known sources.
2. As a system administrator, I want to assign sensors to projects and ponds so that each reading is connected to the correct farm context.
3. As a system administrator, I want to activate or deactivate sensors without deleting them so that historical data remains traceable.
4. As a platform operator, I want raw sensor messages to be retained so that abnormal readings can be investigated from the original source.

### 6. Water Monitoring and Digital Twin

1. As a farmer, I want to view a digital twin of each pond so that water conditions are easier to understand visually.
2. As a farmer, I want to see current water-quality readings so that I can react quickly when conditions start to become unsafe.
3. As a farm manager, I want the platform to highlight abnormal pond conditions so that I can decide which pond needs immediate attention.
4. As a researcher, I want live readings to be organized by pond, cycle, and profile so that the data can support analysis and product validation.

### 7. Visualisation and Historical Trends

1. As a farmer, I want to view water-quality trends over time so that I can understand whether a pond is improving or deteriorating.
2. As a researcher, I want to analyze historical readings by parameter and date range so that I can study the effect of different treatments and conditions.
3. As a business owner, I want clear charts and dashboards so that product results can be explained to customers and stakeholders.
4. As a platform user, I want to export filtered historical data so that information can be shared for reporting, research, or advisory purposes.

### 8. Pond Comparison

1. As a farm manager, I want to compare multiple ponds side by side so that I can identify which pond is performing better.
2. As a researcher, I want to compare parameter trends between ponds so that treatment or operating differences can be evaluated.
3. As a business owner, I want pond comparison results so that product-effectiveness claims can be supported with visual evidence.
4. As a farmer, I want comparison results over a selected date range so that I can make decisions using the period that matters to my operation.

### 9. Alerts and Notifications

1. As a farmer, I want to receive alerts when a water-quality parameter crosses its safe threshold so that I can respond before stock health is affected.
2. As a farm manager, I want alerts to show severity and affected pond information so that I can prioritize the response.
3. As a farm manager, I want to acknowledge alerts so that the team knows when an issue is being handled.
4. As a platform administrator, I want alert history to be retained so that operational incidents can be reviewed later.

### 10. Treatment Management

1. As a farmer, I want to record treatments applied to a pond so that the platform tracks what was done and when.
2. As a researcher, I want to compare pre-treatment and post-treatment readings so that I can evaluate treatment effectiveness.
3. As a product developer, I want to measure outcomes such as nitrogen reduction, water stability, and recovery time so that product performance can be validated.
4. As a business owner, I want treatment-effectiveness summaries so that the product value can be communicated to customers and partners.

### 11. Security, Audit, and Compliance

1. As a platform user, I want my account and project data to be protected so that sensitive farm and business information is not exposed.
2. As a platform administrator, I want user actions and important changes to be logged so that accountability is maintained.
3. As a farm manager, I want alert acknowledgements and treatment records to be traceable so that operational decisions can be reviewed.
4. As a business owner, I want reliable audit evidence so that platform reports can be trusted by customers, researchers, and partners.

### 12. ML Prediction and Agentic Decision Support

1. As a farmer, I want the platform to predict upcoming water-quality conditions so that I can prepare before pond parameters become unsafe.
2. As a researcher, I want the prediction model to use historical pond readings, cycles, treatments, and profile context so that forecasts are based on meaningful aquaculture data.
3. As a product developer, I want unusual sensor patterns and treatment outcomes to be highlighted so that product performance and pond risk can be studied more effectively.
4. As a farmer, I want an assistant to explain critical alerts in simple operational language so that I can understand what happened and what should be checked first.
5. As a researcher or business owner, I want a report assistant that summarizes pond performance, treatment evidence, and comparison results so that findings can be communicated clearly.
6. As a platform user, I want any recommended action to remain human-reviewed so that the system supports decision-making without replacing expert judgement.

## Architectural Constraints

The user stories created architectural constraints that had to be considered from the beginning of the platform design. These constraints focus on product behavior, data responsibility, security, reliability, and planned growth rather than on a single implementation choice.

| No. | Architectural Constraint | Why It Matters | Design Implication |
|---|---|---|---|
| 1 | Multi-stakeholder usage | Farmers, researchers, product developers, business owners, and administrators require different views and permissions. | The platform must support role-based access, project ownership, and configurable feature visibility. |
| 2 | Multi-project and multi-farm support | The same product must support different customers, farms, ponds, and aquaculture profiles. | Data must be organized by project, pond, profile, cycle, and user responsibility. |
| 3 | Real-time operational awareness | Water-quality problems can affect stock quickly, so users need timely information and alerts. | Sensor readings, dashboard updates, and alert decisions must be handled with low delay. |
| 4 | Flexible aquaculture profiles | Different farm types and products may require different parameters, thresholds, and lifecycle stages. | Profile, parameter, threshold, and stage configuration must be adaptable. |
| 5 | Treatment-effectiveness evidence | The business needs measurable proof that the product improves pond conditions and operational outcomes. | Treatments must be linked to sensor readings, pond cycles, comparisons, and reports. |
| 6 | High-volume historical readings | Continuous monitoring produces more data than normal user and project records. | Current readings, historical trends, and summary analytics must be organized for long-term use. |
| 7 | Traceability and auditability | Sensor messages, alerts, treatments, and user decisions must be explainable after the event. | Important actions and data changes must have history, timestamps, and clear ownership. |
| 8 | Secure human and device access | Both people and field devices can affect the trustworthiness of platform data. | Users and devices must be verified before they can access, publish, or modify information. |
| 9 | Reliable farm operations | Farmers should not depend on manual checking alone when pond risk increases. | Monitoring, alerting, and dashboard workflows must remain dependable during normal operation. |
| 10 | ML and Agentic capability | Water-quality prediction and assistant-based explanation require reliable historical readings, treatment records, alerts, and reports. | The platform must preserve clean historical data and clear context so planned prediction and decision-support features can be added safely. |
