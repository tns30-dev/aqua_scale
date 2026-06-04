---
name: architecture-docs
description: Use when writing architecture documentation — ADRs (Architecture Decision Records), C4 diagrams, system-design docs, service specs, the Claude↔Codex review hand-off, and mapping deliverables to the SE33 assessment rubric. Trigger on "write an ADR", "document the design", "C4 diagram", "design doc", "hand off to Codex", "map to rubric", "what marks does this get".
---

# Architecture documentation & the Claude↔Codex loop

Docs-first is our process: we **draft design as `.md`, Codex assesses it, we iterate, then
we build.** Good docs are also direct assessment marks. This skill defines the formats.

## Where docs live
```
docs/
  adr/            ADR-0001-*.md ...        decisions, append-only
  services/       <service>.md             per-service specs (see microservices-decomposition)
  diagrams/       *.drawio / *.mmd          C4 + sequence + deployment
  evidence/       *.md + screenshots        proof for the rubric (pipelines, scans, dashboards)
  *.md            devsecops.md, mlops.md, llmops.md, mlsecops-llmsecops.md, ...
```
Cross-link everything back to `cooking_tracker/background_context/requirement.md`.

## ADR format (use `/adr <title>` to scaffold)
Each ADR: **Context → Decision → Status → Consequences → Alternatives considered →
Rubric link**. Numbered, immutable once Accepted (supersede, don't edit). Template at
`.claude/skills/architecture-docs/templates/adr-template.md`. A **predefined backlog
AD-01…AD-10** is listed in `docs/rubric-map.md` (sourced from `archi_scale.md`) — start there.

## C4 model (the right diagram set for this project)
1. **Context** — AquaMonitoring + actors (farmers, sensors/MQTT devices, ops) + externals.
2. **Container** — the microservices, DBs, event bus, frontend, mesh, on AKS.
3. **Component** — inside a chosen service (e.g. ingestion or ml-inference).
4. **Code** — only where it adds value.
Plus **sequence diagrams** for key flows (sensor reading → alert → notification; agent run)
and a **deployment diagram** (AKS topology). Mermaid for in-repo; drawio for polished.

## Service spec template (per microservice)
Capability · Owned data · Public API (OpenAPI link) · Events published/consumed ·
Dependencies · SLOs · Security notes · Strangler cut-over plan · Rubric mapping.

## Claude↔Codex hand-off protocol
When a design doc is ready for review, produce a **review packet** (use `/handoff-codex`):
1. A short summary of *what changed* and *what decision is being made*.
2. The doc(s) to assess + the relevant `requirement.md` lines they should satisfy.
3. **Specific questions for Codex**: "Does this boundary leak data ownership?", "Is the
   saga correct under partial failure?", "What system-design depth is missing for marks?"
4. Codex returns: assessment (strengths/gaps), deeper system-design detail, rubric-fit
   score. We log the verdict at the bottom of the doc as `## Review (Codex)` and iterate.

Treat Codex as an adversarial reviewer — we *want* it to find gaps before the teacher does.

## Rubric mapping (do this for every deliverable)
Maintain `docs/rubric-map.md`: a table of **rubric criterion → our deliverable → evidence
link → status**. Driven by `requirement.md` page 8. This is how we guarantee marks aren't
left on the table.

## Output of this skill
Well-formed ADRs, C4 + sequence diagrams, service specs, review packets for Codex, and an
up-to-date rubric map.
