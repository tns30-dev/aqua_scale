# Requirements Context

Last updated: 2026-06-03

This file is the grading and submission compass for the AquaShield microservices conversion. It should be loaded before architecture, implementation planning, report writing, or slide drafting.

## Source Inputs

- `cooking_tracker/hard_context_reference/Project Requirements SE33.pdf`
- Teacher email screenshot provided in this session
- Anthropic Skills guide PDF: `The Complete Guide to Building Skills for Claude`

## Immediate Submission Reality

The teacher email states that the first deliverables deadline is 5 Jun 2026. The Project Requirements PDF lists full-time first submission as 7 Jun 2026, but the email should be treated as the operative instruction for this current submission.

Deliverables named in the email:

- Presentation deck
- 1st Internship Project Interim Report
- App demo video, 3-5 minutes
- CICD demo video, 3-5 minutes
- Peer assessment only if this is not an individual or solo internship project

The email also says to start preparing the final report in an agile manner. The interim report becomes the base document that will be refined for the final report. The final report should not be less than 50 pages, and presentation comments/questions must be addressed.

## Capstone Purpose

The project must demonstrate mastery of software engineering by applying tools, techniques, and methods to architect and build a smart system, product, or platform that is secure and scalable.

High-value added dimensions explicitly encouraged by the briefing include:

- Agentic AI
- LLM
- Machine learning
- Analytics
- Safety-criticality
- Real-time behavior
- Fault tolerance
- Hardware integration
- Robotics or vision, where relevant

For AquaShield, the strongest value proposition is:

- Convert the current aquaculture monitoring monolith into a cloud-native microservices architecture.
- Show scalability, security, real-time IoT ingestion, analytics, DevSecOps, MLOps, and LLMSecOps capability.
- Implement a significant working slice instead of only drawing diagrams.
- Provide evidence for every claim.

## Required Project Artifacts

The briefing's Phase 0 and Phase 1 deliverables imply these artifacts:

- Product/platform roadmap with business objectives, strategy, features, services, and scope
- Product/platform backlog with user stories or use cases
- Architectural constraints
- Initial and updated solution architecture
- Architectural risks and mitigations
- Sprint plan and sprint backlog
- Burndown chart
- Sprint review and retrospective evidence
- Software design for critical user stories
- DevOps pipeline design
- Test cases and results
- Codebase and repository URL
- First presentation
- Peer assessment if team-based

For the interim report, do not use a shallow template. The report must comprehensively explain the project and include artifacts that defend the work.

## Presentation Checklist

The Project Requirements PDF gives the following presentation guideline topics. Use this as the deck and report backbone:

1. Project overview and introduction
2. Overall scope using a use case diagram
3. Project roadmap and key milestones
4. Complete project backlog
5. Overall sprint effort to date, including estimate vs actual effort per member
6. Tech stack
7. Architectural constraints and decisions
8. Logical and physical architecture diagrams
9. Deployment diagram
10. Microservice architecture highlighted using Domain-Driven Design
11. Software design
12. Relational DB design, NoSQL design, and collection objects
13. CI/CD pipeline and CI/CD diagram
14. Live demo of the working app and CI/CD demo, or MVP videos
15. Unit, integration, end-to-end, load, and stress testing
16. Management concerns, issues, and mitigations
17. Technical concerns, issues, and mitigations
18. Security concerns, mitigations, and solutions
19. Any other business

## Evidence Rule

The assessor guidance is explicit: do not simply claim that activities were performed.

Every important claim must be backed by one or more of:

- Code artifact
- Architecture diagram
- Sequence/class/component diagram
- Database schema or ERD
- API contract
- CI/CD workflow
- Test result
- Security scan result
- Load/stress test result
- Demo video or screenshot
- Cloud console/Kubernetes evidence
- Log, trace, metric, dashboard, or report artifact

Confidentiality is not a valid reason to omit proof. If something sensitive cannot be shown directly, provide sanitized evidence.

## Highest-Score Strategy For AquaShield

The current monolith alone is not enough for a strong software engineering capstone. The scoring strategy should be to show a credible transformation from an existing inherited system into a production-minded cloud-native platform.

Use this framing:

- Current state: inherited AquaShield monolith, partly refined, with real-time aquaculture monitoring, profile-specific configuration, alerts, charts, energy, pond comparison, RBAC, WebSockets, MQTT ingestion, and PostgreSQL storage.
- Engineering challenge: current architecture cannot convincingly demonstrate scalable, independently deployable, secure service boundaries.
- Target state: domain-driven microservices on Kubernetes with service-level ownership, API gateway, event-driven ingestion, observability, DevSecOps, and selected AI/ML capabilities.
- Significant slice: choose a coherent path that can actually be implemented and demoed. For example, Identity + Project/Profile + Pond/Cycle + Sensor Registry + Ingestion + Alert/Notification + Chart/Analytics, then add one AI/ML/LLM slice.
- Evidence: diagrams, working deployment, CI/CD pipeline, test reports, security scans, performance results, and demo videos.

## Recommended Add-On Features

These should be proposed as architecture goals and implemented selectively based on time.

- DevSecOps: SAST, SCA, SBOM, container scan, secret scan, DAST, branch protection, signed images, vulnerability tracking.
- Cloud-native platform: Kubernetes deployments, HPA, PDB, readiness/liveness probes, rolling deployments, service discovery, ingress/API gateway, network policies, secrets management, IaC.
- MLOps: sensor anomaly detection, disease-risk forecasting, data drift detection, model registry, canary deployment, model monitoring, explainability.
- LLMSecOps: model broker, prompt versioning, structured outputs, guardrails, audit logs, adversarial testing, OWASP LLM Top 10 risk register.
- Agentic AI: aquaculture operations copilot, alert explanation agent, report generation agent, sensor data quality agent, knowledge/RAG assistant, human-in-the-loop approvals.
- Observability: traces, metrics, logs, dashboards, alerting, token/cost ledger for LLM components.

## Claude And Codex Working Model

The Anthropic Skills guide describes skills as repeatable workflow packages with:

- `SKILL.md` instructions
- YAML frontmatter for trigger conditions
- Optional `scripts/`
- Optional `references/`
- Optional `assets/`
- Progressive disclosure so only the relevant context is loaded
- Testing for triggering, functional correctness, and performance improvement

For this project, use the same operating idea even if the exact folder is not yet installed as Claude skills.

Recommended long-session context split:

- `requirement.md`: grading, deliverables, evidence rules, and submission strategy
- `aquashield.md`: current system context from code and local notes
- `archi_scale.md`: scalable cloud-native target architecture
- `security.md`: security and DevSecOps target posture
- `agentic_ai.md`: Agentic AI, LLMSecOps, and MLOps capability patterns

Collaboration contract:

- Claude drafts architecture, report narrative, decomposition options, and implementation plans.
- Codex verifies against local code, source documents, and evidence.
- Codex should challenge unsupported claims and ask for artifacts.
- Each major feature must answer: why it helps marks, what current code supports it, what target architecture changes, what will be implemented, and what evidence will prove it.

## Do Not Claim Yet

Unless implementation evidence is later created, do not claim AquaShield already has:

- Kubernetes production deployment
- True microservices with independent service databases
- Service mesh or zero-trust mTLS
- Full CI quality gates
- Full DAST/load/stress test evidence
- MLOps lifecycle
- LLMSecOps lifecycle
- Agentic AI runtime
- Model broker
- RAG knowledge base
- Promptfoo/DeepEval/DeepTeam test evidence
- Langfuse dashboard

Those are target capabilities until implemented and verified.
