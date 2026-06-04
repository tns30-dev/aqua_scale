# Skills index — AQ_Cook (AquaShield microservices)

Skills are **progressive-disclosure** capability packs: Claude loads a skill's `SKILL.md`
only when its `description` matches the task, keeping every session lean. All skills are
grounded in the **decided specs** under `cooking_tracker/main/` — they apply the specs,
they don't re-litigate them.

## Active skills (implementation phase)

| Skill | Trigger summary |
|-------|-----------------|
| `java-spring-microservice` | Implement/scaffold any service: Java 21 + Spring Boot/WebFlux, gRPC, Flyway, Testcontainers, Dockerfile; TS/Express analytics deviations |
| `microservices-decomposition` | Boundary/ownership questions; monolith-parity workflow (Django module → new service) |
| `gcp-data-stores` | Cloud SQL schemas/replica, Redis key catalogue + authz snapshot, Bigtable row keys, BigQuery cost caps |
| `pubsub-eventing` | Topic catalogue, event envelope, schemas, DLQs, idempotent consumers, outbox, replay |
| `iot-aws-bridge` | AWS IoT Core (certs/policies/rules), TS Lambda bridge, WIF → Pub/Sub, simulator |
| `cloud-native-k8s` | GKE workload manifests, Kustomize, Argo CD apps, NetworkPolicy, mesh AuthorizationPolicy, gateway routes |
| `devsecops-pipeline` | Path-aware CI, scan gates, SBOM, OIDC/WIF, Artifact Registry, GitOps handoff, ZAP, JMeter |
| `architecture-docs` | ADRs, diagrams, Codex hand-off packets, rubric mapping |

## Dormant skills (future add-ons — do not build yet)

| Skill | Wakes up when |
|-------|---------------|
| `mlops-lifecycle` | ML add-on phase starts (anomaly/forecast models) |
| `llmops-agentic` | LLM/agentic add-on phase starts |
| `ml-llm-secops` | Either AI add-on ships |

## Agents & commands

| Item | Purpose |
|------|---------|
| agent `monolith-parity-checker` | Extract Django business rules/API contracts as a parity spec before building a service |
| agent `system-design-reviewer` | Adversarial design check before Codex review |
| command `/sync-tracker` | Update `cooking_tracker/claude/*_tracker.md` for Codex sync (mandatory after progress) |
| command `/adr` | Scaffold an ADR in `docs/adr/` |
| command `/handoff-codex` | Build a review packet for Codex |

## Authoring conventions

One folder per skill: `.claude/skills/<kebab-name>/SKILL.md` with `name` + `description`
frontmatter (the description is the trigger — make it a precise when-to-use). Keep SKILL.md
tight; heavy detail goes in sibling files loaded on demand. Project-specific > generic.
