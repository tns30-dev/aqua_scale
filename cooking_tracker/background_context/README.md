# background_context — source-of-truth inputs

These five files are the **authoritative inputs** all architecture/implementation work is
reconciled against. **Codex authors & maintains them** from `../hard_context_reference/` and
the live `AquaMonitoringv2/` code. Claude reads them; does not overwrite.

| File | Purpose |
|------|---------|
| `requirement.md` | Grading, deliverables, **5 Jun 2026** deadline, 19-pt presentation rubric, evidence rule, "do-not-overclaim" list. The submission compass. |
| `aquashield.md` | Current system: Django modules, data flows, deployment, testing, honest gaps. |
| `archi_scale.md` | Target cloud-native architecture: 10 bounded contexts, comms patterns, persistence, K8s, CI lanes, phased migration, ADR list. |
| `security.md` | Trust boundaries (TB-1…TB-7), threat register (T-01…T-16), current vs target controls, DevSecOps + LLMSecOps tooling. |
| `agentic_ai.md` | Agentic AI / MLOps / LLMSecOps patterns distilled from **AssessorFlow** (Model Broker, gate agents, golden pipeline). |

Every deliverable maps back to a `requirement.md` line via `docs/rubric-map.md`.
Reference projects to mine for proven patterns: **ChronoFlow** (scalable + secure) and
**AssessorFlow** (agentic AI).
