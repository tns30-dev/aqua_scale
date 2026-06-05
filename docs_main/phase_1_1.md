# Sprint Plan

The sprint plan organizes AquaShield as a sequence of one-week product increments. The earlier sprints focus on product understanding, design, core platform capability, monitoring, comparison, alerts, treatment records, quality, and deployment readiness. The planned later sprints extend the platform with ML-based water-quality prediction and four agentic decision-support use cases.

| Sprint | Duration | Sprint Focus | Status | Planned Outcome |
|---|---|---|---|---|
| Sprint 1 | 1 week | Product discovery and platform direction | Completed | Confirm the product objective, target users, main business value, and initial scope. |
| Sprint 2 | 1 week | Product backlog and use-case design | Completed | Define major epics, user stories, use cases, and key platform constraints. |
| Sprint 3 | 1 week | Data and domain design | Completed | Define the main business entities, relationships, pond context, cycle context, sensor context, and treatment context. |
| Sprint 4 | 1 week | Architecture and software design | Completed | Define the solution structure, major platform responsibilities, interaction flow, and critical design decisions. |
| Sprint 5 | 1 week | User, project, profile, and pond foundation | Completed | Implement the core management flow for users, projects, farm profiles, ponds, parameters, and threshold setup. |
| Sprint 6 | 1 week | Monitoring, digital twin, visualisation, and treatment records | Completed | Provide pond monitoring, current readings, historical visualisation, and treatment record foundation. |
| Sprint 7 | 1 week | Alerts, notification flow, and traceability | Completed | Add threshold-based alerts, acknowledgement flow, notification readiness, and operational history. |
| Sprint 8 | 1 week | Pond comparison and reporting | Completed | Provide comparison between ponds, summary views, and evidence-style reporting for researchers and business users. |
| Sprint 9 | 1 week | Quality, security, deployment, and presentation evidence | Completed | Validate the platform, prepare review evidence, and demonstrate that the product increment can be operated professionally. |
| Sprint 10 | 1 week | ML water-quality prediction | Planned | Build a prediction workflow for upcoming pond water-quality conditions using historical readings, cycles, treatments, and profile context. |
| Sprint 11 | 1 week | Agentic alert explanation | Planned | Explain critical pond alerts in simple operational language so users understand what happened and what to check first. |
| Sprint 12 | 1 week | Agentic report assistant | Planned | Summarize pond performance, treatment evidence, and comparison results for farmers, researchers, and business owners. |
| Sprint 13 | 1 week | Agentic grounded Q&A | Planned | Answer user questions using available project records, pond records, treatment notes, and platform reports. |
| Sprint 14 | 1 week | Agentic human-reviewed recommendation | Planned | Generate operator-facing recommendations that remain subject to human review before action is taken. |

## Sprint Planning Rationale

The sprint order follows the dependency structure of the product. AquaShield first needs a clear product objective and backlog, then a stable design for projects, ponds, profiles, readings, treatments, alerts, and reports. Only after this foundation is available does it make sense to introduce ML prediction, because prediction depends on meaningful historical data. The agentic use cases are placed after ML because they rely on the same trusted platform records and should explain or summarize existing evidence rather than invent decisions without context.
