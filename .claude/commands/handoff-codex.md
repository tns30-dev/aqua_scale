---
description: Produce a review packet handing the current design docs to Codex for assessment
argument-hint: <doc path(s) or topic to review>
---

Prepare a **Codex review packet** for: **$ARGUMENTS**

Produce a single markdown block the user can paste to Codex containing:
1. **What changed / what decision is on the table** — 3-5 sentences.
2. **Docs to assess** — paths + a 1-line purpose each.
3. **Requirements they must satisfy** — quote the relevant lines from
   `cooking_tracker/background_context/requirement.md`.
4. **Specific assessment questions** — pointed, adversarial: data-ownership leaks, failure
   modes, saga correctness, security gaps, and *what system-design depth is missing for marks*.
5. **Requested output from Codex** — strengths, gaps, deeper system-design detail, and a
   rubric-fit score, to be pasted back under `## Review (Codex)` in each doc.

Do not modify the docs; only generate the packet.
