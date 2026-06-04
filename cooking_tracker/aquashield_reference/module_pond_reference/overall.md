# Module Pond — Overall Plan

> Refine and consolidate `module_pond` until it's as stable as `module_user` and `module_project`. Schema gaps, admin polish, missing API surface, and supporting data work. Mirrors the Part-N structure used in `project_mgmt_reference/`.

---

## Why this arc

`module_pond` got *segregated* from `module_project` in a prior arc (Pond, Cycle, CycleDailyHealth, CycleStageMetric moved over) and recently absorbed two new models (Treatment, PondTreatment). Segregation worked, but the module hasn't received the same kind of full refinement pass project-mgmt did. Audit surfaces six problems:

1. **`Pond` is schema-thin.** No `status` column (the model method `get_active_ponds()` infers activity via `Cycle.status='ongoing'`), no `code` machine identifier (admin + FE compare against `name`, the display label — same anti-pattern we just fixed for `ProfileType`), and no audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`).
2. **Admin is unpolished.** Every admin in `module_pond/admin.py` uses vanilla `admin.ModelAdmin`, not the Unfold-backed `ModelAdmin` we adopted everywhere else. No `fieldsets`, no per-row Edit buttons, no list filters on most tables. `Pond.metadata` and `CycleStageMetric.metrics` render as raw JSON textareas — same UX gap that triggered the stage-editor work in project-mgmt. `CycleDailyHealth.health_status` is an open `CharField` with no choices.
3. **Treatment + PondTreatment are under-wired.** Models + admin exist; **no serializers, no views, no endpoints, no inline under PondAdmin.** A FE consumer can't reach them. PondTreatment has no overlap validation, so admins can create double-booked treatments on the same pond.
4. **Cycle / CycleDailyHealth / CycleStageMetric have no FE API.** They're consumed only via the existing chart pipeline. If the FE ever needs to surface daily health timelines or per-stage metric tables directly, there's no endpoint.
5. **Convention drift risk.** The `.name` vs `.code` slip we caught in `auth/me` (Phase 6d of project-mgmt Part 2) might exist elsewhere in `module_pond`. Need to audit.
6. **No tests.** `module_pond/tests/` has only `__init__.py`. Compare to `module_user` (96% coverage). Out of scope here per CLAUDE.md, but worth flagging in case Part 3 wants to address.

---

## Source-of-truth references

| Doc | Use |
|---|---|
| `project_mgmt_reference/` | Template — exact pattern this arc mirrors |
| `module_pond_segregation_reference/` | Earlier arc that moved Pond+Cycle from module_project; describes the relocation choices |
| `pond_comparison_reference/` | Pond Comparison feature (Phases 3+4) — `module_pond/services/pond_comparison.py` |
| `archive/erd_finalization/view_pond.md` | Older ERD doc for ponds + cycles |
| `archive/class_diagram_finalization/view_project.md` | Class diagram for Pond + Cycle (still useful — they used to live in module_project) |

---

## Out of scope (for now)

| Item | Why |
|---|---|
| Tests | Per the same convention used in project_mgmt — spec moving; manual smoke is sufficient. Could move to Part 3 if you change your mind. |
| WebSocket / `consumers.py` refactor | Behaviour preserved verbatim during segregation; works. Out of scope unless Part 3 surfaces a problem. |
| Pond Comparison feature changes | Shipped + working. Out of scope. |
| Reading partition scheme (`sensor_readings`) | Owned by `module_data_ingestion`. Separate arc. |
| Cycle stage_config (lives on `profile_types`) | Already polished in project-mgmt Phase 6e. |

---

## Proposed Parts

### Part 1 — Backend consolidation

Goal: BE schema + admin + API surface match the polish level of `module_project` post-Part-1.

Sketch (phases finalised when Part 1 starts):

- **Phase 1** — SQL schema patches. Add `Pond.status` (5-state enum per D1). Add audit columns on Pond + Cycle + CycleDailyHealth + CycleStageMetric (Treatment + PondTreatment already have them). Tighten `CycleDailyHealth.health_status` with a CHECK constraint matching the existing implicit enum.
- **Phase 2** — `Pond` model refinement. Surface `status` + audit fields. Add class methods (`get_active_cycle()`, `is_active()`, etc.). Audit cross-module consumers for any `.code`-style anti-patterns (mirrors Phase 6d of project-mgmt).
- **Phase 3** — `Cycle` / `CycleDailyHealth` / `CycleStageMetric` refinement. Choices on `health_status`. Class methods aligned with the class diagram.
- **Phase 4** — Admin polish: Unfold upgrade for all 6 admins; per-row Edit buttons; list filters; structured editor for `CycleStageMetric.metrics`; readable widget for `Pond.metadata`; choices dropdown for `health_status`; **`PondTreatment` inline under `PondAdmin`** so admins manage treatments alongside the pond.
- **Phase 5** — Serializers for Treatment, PondTreatment, CycleDailyHealth, CycleStageMetric. Snake → camel mapper baked in per D4 (the project-mgmt decision).
- **Phase 6** — Views + URLs. `GET /api/treatments/`, `GET /api/ponds/<id>/treatments/`, maybe `GET /api/cycles/<id>/daily-health/` and `GET /api/cycles/<id>/stage-metrics/` depending on FE need.
- **Phase 7** — ~~Seed data~~ **DROPPED (D6)**. User creates Treatment + PondTreatment rows via the Django admin (which Phase 4 polished). Pond.status defaults to `'active'` for all 16 demo ponds — no seed adjustment needed.
- **Phase 8** — ~~Validation: overlapping PondTreatments~~ DROPPED (D4: overlaps allowed).
- **Phase 9** — Smoke + DB validation across the whole arc.
- **Phase 10** — Docs.

### Part 2 — Frontend integration

Goal: surface the new BE work in the React app. Scope depends entirely on Part 1's API additions. Likely:

- Pond detail page renders treatments list + lets admins (via the Django admin) add new entries.
- `Pond.status` flows through to the Overview pond-card rendering (active vs draining vs decommissioned).
- Treatment catalogue dropdown when a PondTreatment is being created.

Finalised when Part 1 finishes.

### Part 3 — Polish (placeholder)

Reserved. Likely candidates: tests (if you change your mind), overlap-detection UX in the admin, cycle timeline visualizations, etc.

---

## Resolved decisions

### D1 — `Pond.status` = 5-state enum

```
'active' | 'draining' | 'cleaning' | 'maintenance' | 'decommissioned'
```

- `active` — has an ongoing cycle / in production
- `draining` — being emptied (pre-harvest or pre-clean)
- `cleaning` — between cycles, being disinfected / refreshed
- `maintenance` — under repair / inspection (separate from cleaning)
- `decommissioned` — retired permanently

Stored as `varchar(20) NOT NULL DEFAULT 'active'` with a CHECK constraint enforcing the enum. Admin renders as a dropdown via `choices`.

### D2 — `Pond.code` is NOT added (dropped)

No machine-identifier column on Pond. `Pond.name` remains the identifier (semantically) and the display label. The only new column on `ponds` from this arc is `status`.

### D3 — Treatment catalogue stays as-is (M:N junction)

`treatments` table is preserved as the master catalogue. Admins add Treatment rows freely — treatment **names** aren't a fixed enum (no DB CHECK). `pond_treatments` stays as the junction with FK to `treatments`. No schema change here.

### D4 — Allow overlapping PondTreatments

Concurrent treatments on the same pond are realistic (water change + probiotic running together). No DB constraint, no admin warning. **Phase 8 is dropped** from the plan.

### D5 — Full e2e coverage for pond-related entities

Every pond-related model gets a serializer + read-only API endpoint. Frontend gets pages/sections that render them. Mutations stay in Django admin (no React-side CRUD), matching the convention from project-mgmt Part 2.

Affected models in Phase 5/6:
- `Pond` (already has endpoint; needs updates for new fields)
- `Cycle` (already has endpoint)
- `CycleDailyHealth` (needs serializer + endpoint)
- `CycleStageMetric` (needs serializer + endpoint)
- `Treatment` (needs serializer + endpoint — list catalogue)
- `PondTreatment` (needs serializer + endpoint — per-pond timeline)

### D6 — No seeded data for Treatment / PondTreatment

User creates Treatment catalogue entries + PondTreatment timeline rows via the Django admin (`/admin/module_pond/treatment/` + `/admin/module_pond/pondtreatment/` + the inline under PondAdmin). Phase 7 is dropped. The single pre-existing `BioBloc` Treatment row stays (added in an earlier arc; user can keep, edit, or delete via admin).

---

## Engineering rules (carry-over + arc-specific)

- One checklist item per edit. Track in the phase doc immediately.
- `phase_N.md` written BEFORE executing the phase.
- Database-first design: SQL files lead, models follow (`managed = False`).
- `aquashield_current_local_share.sql` is the canonical seed (INSERT statements).
- Two-repo flow: implement on learning → smoke → port to prod on user signal → commit on learning.
- No auto-commits. No per-action approval bypass on prod.

### SQL convention — strict this arc

Every phase that changes SQL produces a runnable incremental migration script at:

```
backend/sql/module_pond_phase_<N>.sql
```

Each script:

- Opens with `BEGIN;` and closes with `COMMIT;` (Postgres transactional DDL).
- Idempotent where possible: `IF NOT EXISTS` / `IF EXISTS` on ADD/DROP COLUMN, `DROP CONSTRAINT IF EXISTS` then `ADD CONSTRAINT`, etc.
- Comments each statement with the *why* (not just *what*).
- **Does NOT update `aquashield_current_local_share.sql` or `aquashield_current_schema_only.sql`.** The seed files stay frozen at their committed baseline. The colleague's workflow is: load the seed once → apply the phase migrations in order on top. Each migration is forward-only and assumes the previous one ran (or the seed was loaded for `module_pond_phase_1.sql`).
- Verified by: load fresh scratch DB from `aquashield_current_local_share.sql` → apply the migration → inspect resulting shape via `\d`. No diff against the seed expected (seed is the *pre*-migration state).

---

## Phase / Part status

```text
Part 1 (Backend consolidation)                            TODO  -> part_1/ (to be created)
  Phase 1 (SQL: Pond.status + .code + audit)              TODO
  Phase 2 (Pond model refinement)                         TODO
  Phase 3 (Cycle / Health / Metric refinement)            TODO
  Phase 4 (Admin polish)                                  TODO
  Phase 5 (Treatment / PondTreatment serializers)         TODO
  Phase 6 (Views + URLs)                                  TODO
  Phase 7 (Seed data)                                     DROPPED (D6 — user-managed via admin)
  Phase 8 (Overlap validation)                            DROPPED (D4)
  Phase 9 (Smoke)                                         TODO
  Phase 10 (Docs)                                         TODO
Part 2 (Frontend integration)                             TODO  -> part_2/ (after Part 1)
Part 3 (Polish)                                           TBD
```

---

*Last updated: 2026-05-23*
