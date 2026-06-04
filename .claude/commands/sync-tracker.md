---
description: Update Claude's tracker files in cooking_tracker/claude/ so Codex stays in sync
argument-hint: [optional: what was just completed/progressed]
---

Sync the trackers for Codex. Context: **$ARGUMENTS**

1. Review what was actually accomplished this session (conversation + git status/diff).
   Only record verified progress — no aspirational status.
2. For each affected tracker in `cooking_tracker/claude/`
   (`services_tracker.md`, `data_and_messaging_tracker.md`, `security_tracker.md`,
   `ci_cd_and_testing_tracker.md`):
   - Update item **Status** (⬜/🟨/✅/⛔), **Progress notes**, **Evidence** link, **Updated** date.
   - Refresh **Summary for Codex** (current focus / last completed / blockers & questions).
   - Append a dated **Log** line describing the change.
   - Bump `Last updated:`.
3. If an item is fully done with evidence: tick it in `cooking_tracker/claude/checklist.md`
   AND the matching row in `cooking_tracker/main/checklist.md`.
4. If blocked on Codex-owned work (cloud foundation, mesh, edge) or on the user
   (credentials, decisions), record it explicitly under Blockers so Codex/user can act.
5. Print a short sync summary the user can paste to Codex.
