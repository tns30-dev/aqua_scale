---
description: Scaffold a new Architecture Decision Record in docs/adr/
argument-hint: <short decision title>
---

Create a new ADR for: **$ARGUMENTS**

Steps:
1. Find the next ADR number by listing `docs/adr/` (start at 0001 if empty).
2. Copy the structure from `.claude/skills/architecture-docs/templates/adr-template.md`.
3. Create `docs/adr/ADR-<NNNN>-<kebab-title>.md`, filling Context/Decision/Consequences/
   Alternatives from the current conversation. Leave the `## Review (Codex)` section as a
   stub for Codex.
4. Link it to the relevant criterion in `cooking_tracker/background_context/requirement.md`.
5. Add a row to `docs/rubric-map.md` (create it if missing) tying this decision to the rubric.
6. Print the path and a one-paragraph summary suitable for a Codex review packet.
