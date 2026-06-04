# Project Management — Overall Plan

> Refine and consolidate `module_project` until it's as stable as `module_user`. Backend models + admin + SQL + frontend consumption. Like user-mgmt, broken into Parts; each Part has its own folder + `overall.md` + phase docs.

---

## Why this arc

`module_project` is small in surface today (two models: `ProfileType` and `Project`) but **load-bearing** — every other module references projects or profile-driven config. Investigation surfaced five problems:

1. **Dead columns** in `profile_types` (`default_parameters`, `parameter_priority`) and `projects` (`parameters`, `parameter_priority`). Per Satish: never used. Schema still carries them.
2. **No Django model** for `growth_indicators`. Pure SQL DDL. Soft-referenced from `profile_types.key_growth_indicators TEXT[]` per ERD, but unreachable from Python.
3. **Module ownership is wrong for two tables.** `parameter_types` and `project_parameter_settings` are conceptually project-domain reference data — but they're defined in `module_sensor/models.py` today (`ParameterType` at line 10, `ProjectParameterSetting` at line 556). `growth_indicators` has no home.
4. **Theme config is hardcoded on the FE.** Per-profile colours, icons, gradients live as TypeScript literals in `frontend/src/config/profiles/{shrimpProfile,fishProfile}.ts`. New profiles in DB are blind to the FE.
5. **`ProfileType` is a TS union literal** (`'shrimp' | 'fish' | 'crab_hatchery' | 'treatment'`). Adding a profile in the DB requires a code release.

The arc fixes all five across BE + FE, lands Django admin CRUD (admin path only, no React user CRUD), and makes the FE driven by what the DB says — **`frontend/src/config/profiles/` gets deleted, not repurposed.**

---

## Module ownership reshape (the headline structural change)

After this arc, `module_project` becomes the home for **five** models — all the reference data + per-project configuration that aquaculture projects depend on:

| Model | DB table | Today | After |
|---|---|---|---|
| `ProfileType` | `profile_types` | `module_project` | `module_project` (stays, refined + theme columns added) |
| `Project` | `projects` | `module_project` | `module_project` (stays, refined) |
| `ParameterType` | `parameter_types` | **`module_sensor`** (misclassified) | **`module_project`** (moves) |
| `GrowthIndicator` | `growth_indicators` | **(no model)** | **`module_project`** (new model) |
| `ProjectParameterSetting` | `project_parameter_settings` | **`module_sensor`** (misclassified) | **`module_project`** (moves) |

`module_sensor` keeps `SensorType`, `Sensor`, etc. — actual sensor-hardware concepts. Parameters (what we measure) are project-domain, not sensor-domain.

Both `key_parameter_indicators` and `key_growth_indicators` stay as `TEXT[]` on `profile_types` — soft reference by code, simple, no per-entry metadata needed.

---

## Source-of-truth references

| Doc | Use |
|---|---|
| `project_mgmt_reference/AquaShield UML Diagrams-ERD Diagram.drawio-2.png` | **Latest ERD** (parameter_types + growth_indicator under module_project; both `key_*_indicators` AND `is_key_parameter` shown — they coexist) |
| `archive/erd_finalization/view_profile_type.md` | Older ERD finalization doc — still useful for column details |
| `archive/erd_finalization/view_project.md` | Older ERD doc for projects + project_parameter_settings |
| `archive/class_diagram_finalization/view_profile_type.md` | Target class for `ProfileType` (incl. methods) |
| `archive/class_diagram_finalization/view_project.md` | Target classes for `Project`, `Pond`, `ProjectParameterSetting` |
| `module_pond_segregation_reference/` | Template — model-move pattern from a previous arc |

Where the latest ERD and the older `view_*.md` docs disagree, **latest ERD wins.**

---

## Resolved decisions

These were the open questions at the first draft of this overall.md. Now closed:

### D1 — Profile-level vs project-level "key parameter" — coexist (Option A)

Latest ERD shows BOTH `profile_types.key_parameter_indicators TEXT[]` AND `project_parameter_settings.is_key_parameter BOOLEAN`. They coexist by design:

- `profile_types.key_parameter_indicators` = template defaults. All shrimp projects start with the same set.
- `project_parameter_settings.is_key_parameter` = per-project override. Operator can flip individual flags.

UI reads project-level if set; otherwise falls back to profile-level. No schema simplification needed.

### D2 — Theme stored in DB (Option B)

Theme columns added to `profile_types`. Specifically:

| Column | Type | Purpose |
|---|---|---|
| `theme_primary` | VARCHAR(7) | Hex colour, e.g. `#3B82F6` |
| `theme_secondary` | VARCHAR(7) | Hex colour |
| `theme_accent` | VARCHAR(7) | Hex colour |
| `theme_gradient_from` | VARCHAR(7) | Hex colour |
| `theme_gradient_to` | VARCHAR(7) | Hex colour |
| `icon` | VARCHAR(50) | Lucide-react icon name, e.g. `'Droplets'`, `'Fish'`, `'Bug'` |

FE reads these via `GET /api/profile-types/` and applies them at render time. No FE fallback module — DB is the single source.

### D3 — `ProjectParameterSetting` admin shape — inline only (Option A)

Settings only editable inline on the Project change page. No standalone changelist. Matches conceptual ownership (settings are scoped to a project).

---

## Out of scope

| Item | Why |
|---|---|
| Tests (BE + FE) | User-directed: spec is still moving; revisit when stable. Each Part validates with manual checks + `manage.py check` + scratch DB loads + browser smoke. |
| Cycle / Pond schema changes | Lives in `module_pond` now. Separate arc. |
| `module_chart` refactor | Only touched at FK level (`'module_sensor.ParameterType'` → `'module_project.ParameterType'`). Internals untouched. |
| `module_sensor` consolidation | Only touched to remove the misclassified models. SensorType / Sensor stay. |
| User-facing React CRUD for ProfileType / Project / ParameterType / GrowthIndicator | Admin uses Django admin (`/admin/`). React app stays read-only. |
| Auth / RBAC changes | `module_user` is settled; no permission model changes here. |

---

## Current state (snapshot)

### Backend models

```text
module_project/models.py
  ProfileType (managed = False)
    OK  profile_type_id, code, name, description
    OK  stage_config, key_parameter_indicators, key_growth_indicators
    OK  created_at / by, updated_at / by
    XX  default_parameters    (dead column, still declared)
    XX  parameter_priority    (dead column, still declared)
    -   no theme_* columns yet

  Project (managed = False)
    OK  project_id, project_owner_id (FK), profile_type_id (FK), name, description
    OK  created_at, created_by, updated_at, updated_by  (audit cols already in SQL)
    XX  parameters            (dead column, still declared)
    XX  parameter_priority    (dead column, still declared)

module_sensor/models.py
  XX  ParameterType                <- belongs in module_project
  XX  ProjectParameterSetting      <- belongs in module_project

(nowhere)
  XX  growth_indicators            <- SQL table exists, NO Django model anywhere
```

### Backend SQL

- `profile_types` has a leftover `CONSTRAINT profile_types_name_check` limiting `name` to `('shrimp', 'fish', 'crab_hatchery', 'treatment')`. Since `code` is now the machine identifier and `name` is display-only, this check should be dropped.
- `profile_types.default_parameters` + `profile_types.parameter_priority` + `projects.parameters` + `projects.parameter_priority` — all dead, to be dropped.
- `profile_types` has no theme_* columns yet — to be added per D2.
- `growth_indicators` table exists in SQL; no Django model.

### Cross-module references to relocate

| File | Current | Becomes |
|---|---|---|
| `module_chart/models.py:31` | String FK `'module_sensor.ParameterType'` | `'module_project.ParameterType'` |
| `module_chart/services/chart_service.py:261` | `from module_sensor.models import ParameterType` | `from module_project.models import ParameterType` |
| `module_data_ingestion/services.py:160` | `from module_sensor.models import ProjectParameterSetting` | `from module_project.models import ProjectParameterSetting` |
| `module_data_ingestion/consumers.py:204` | Same | Same |
| `module_data_ingestion/management/commands/seed_reading_partitions.py:16` | `from module_sensor.models import ParameterType` | `from module_project.models import ParameterType` |
| `module_project/management/commands/seed_demo_data.py:19` | `from module_sensor.models import ParameterType, ..., ProjectParameterSetting` | `from module_project.models import ParameterType, ProjectParameterSetting` |
| `scripts/data_simulator.py:38` | `from module_sensor.models import ParameterType` | `from module_project.models import ParameterType` |
| `scripts/verification/test_sensor_models.py:19` | `ParameterType, ..., ProjectParameterSetting` | Split: ParameterType + ProjectParameterSetting come from `module_project.models`; rest stays |
| `module_sensor/admin.py:8-9` | `@admin.register(ParameterType) class ParameterTypeAdmin` | Move to `module_project/admin.py` |
| `module_sensor/admin.py` (ProjectParameterSetting) | Registered here | Move to `module_project/admin.py` (inline under Project per D3) |
| `module_sensor/serializers.py:7` | `ParameterTypeSerializer` | Move to `module_project/serializers.py` |
| `module_sensor/serializers.py` (ProjectParameterSetting) | Possibly registered here | Move to `module_project/serializers.py` if still needed |

Approximately **~12 file-level changes** + admin/serializer moves.

### Frontend

```text
frontend/src/types/profile.ts
  XX  ProfileType = 'shrimp' | 'fish' | 'crab_hatchery' | 'treatment'   <- TS union literal
  OK  ProfileConfig, ProfileTheme, etc. - interface defs (keep, but feed from API)

frontend/src/config/profiles/         <-- ENTIRE DIRECTORY GETS DELETED
  XX  index.ts          - hardcoded registry mapping ProfileType -> ProfileConfig
  XX  shrimpProfile.ts  - full hardcoded config (theme, parameters, thresholds)
  XX  fishProfile.ts    - same
                        - crab_hatchery + treatment inlined in index.ts

frontend/src/context/ProfileContext.tsx
  ~~  Imports getProfileConfig / getDefaultProfile / isValidProfile from the hardcoded config
  OK  userProfiles is dynamic (derives from session.projects.profileType)
  XX  Filters via isValidProfile(t) which uses the TS union

frontend/src/components/layout/ProfileDropdown.tsx
  ~~  Reads from ProfileContext - once context is API-driven, this consumes the new shape
```

---

## Target state (after this arc)

### Backend

- `ProfileType` model: dead columns dropped. **Six new theme columns** (`theme_primary`, `theme_secondary`, `theme_accent`, `theme_gradient_from`, `theme_gradient_to`, `icon`). Class methods per the class diagram (`get_stages()`, `get_stage_by_day()`, `get_key_parameters()`, `get_key_growth_indicators()`, `get_cycle_length()`).
- `Project` model: dead columns dropped. Class methods per the class diagram (`get_ponds()`, `get_active_ponds()`, `get_parameter_settings()`, `get_key_parameters()`, etc.).
- `ParameterType` model: moved into `module_project`. Same fields, same `db_table = 'parameter_types'`.
- `GrowthIndicator` model: **new** Django model under `module_project`, mapping to existing `growth_indicators` table.
- `ProjectParameterSetting` model: moved into `module_project`. Method `is_within_threshold(value)` per class diagram.
- Django admin (via `django-unfold`) — CRUD for all five models. `ProjectParameterSetting` inline under Project (D3-A).
- Read-only API endpoint `GET /api/profile-types/` — returns the full template payload incl. theme + stage_config + key indicator codes. Possibly `GET /api/parameter-types/` and `GET /api/growth-indicators/` if FE needs the catalogue for lookup.
- SQL: dead columns dropped; `profile_types_name_check` dropped; theme columns added.

### Frontend

- `ProfileType` becomes `string` — no enum literal.
- `frontend/src/config/profiles/` — **deleted entirely.** No fallback module. DB is the source.
- `ProfileContext` fetches `GET /api/profile-types/` on session load, builds an in-memory registry, exposes the same `useProfile()` shape to consumers (just dynamic).
- Consumers (ProfileDropdown, Overview, Historical, Forecast) keep working — they read from `useProfile()` which now returns dynamic config.
- Adding a new profile in Django admin (`/admin/module_project/profiletype/add/`) immediately appears in the React app on next session refresh.

---

## Parts

Each Part is its own folder under `project_mgmt_reference/`. Folder layout matches `user_mgmt_reference/part_2/` and `part_3/`.

### Part 1 — Backend consolidation + module ownership reshape

Goal: BE is in the target state. All five models live in `module_project`. SQL is clean (incl. theme columns added). Django admin CRUD works. API endpoint(s) exist for the FE to consume (FE still hardcoded — Part 2's job).

Phases (concrete checklists in `part_1/phase_N.md`):

- Phase 1 — SQL schema clean-up: drop dead columns; drop `profile_types_name_check`; **add the six theme_* columns to `profile_types`**; verify scratch-DB load.
- Phase 2 — `ProfileType` + `Project` model refinement: prune dead fields; add theme fields; add class methods per class diagram.
- Phase 3 — Model relocation: move `ParameterType` and `ProjectParameterSetting` from `module_sensor/models.py` to `module_project/models.py`; create `GrowthIndicator` in `module_project/models.py`. Use `managed=False` everywhere.
- Phase 4 — Cross-module FK + import sweep: update FK string in `module_chart/models.py`; update direct imports in `module_chart/services/`, `module_data_ingestion/services.py` + `consumers.py` + seed command, `module_project/management/commands/seed_demo_data.py`, `scripts/data_simulator.py`, verification scripts.
- Phase 5 — Admin + serializer migration: move `ParameterTypeAdmin` + `ProjectParameterSetting` admin from `module_sensor/admin.py` to `module_project/admin.py`. Move corresponding serializers. Add new `GrowthIndicator` admin + serializer.
- Phase 6 — Project admin shape: implement Django admin CRUD for `ProfileType` (with theme colour pickers), `Project` (with `ProjectParameterSetting` inline per D3-A), `ParameterType`, `GrowthIndicator`. Apply lessons from user-mgmt Part 3 amendment (avoid Unfold pitfalls).
- Phase 7 — Views + URLs: `GET /api/profile-types/` returning the full template payload. Add `/api/parameter-types/` and/or `/api/growth-indicators/` if Part 2 needs them.
- Phase 8 — Seed the theme columns for the four existing profiles (shrimp/fish/crab_hatchery/treatment) so Part 2 has data to render. Pull colours/icons from the existing hardcoded `shrimpProfile.ts` / `fishProfile.ts` / inlined defs in `index.ts`.
- Phase 9 — Manual smoke + DB validation.
- Phase 10 — Docs (file_touch_tracker + dod note).

### Part 2 — Frontend consolidation

Goal: FE reads profile config from the API instead of hardcoded TS files. `ProfileType` type-level union retired. **`frontend/src/config/profiles/` directory deleted entirely.**

Sketch (phases finalised when Part 2 starts):

- Phase 1 — Types: drop `ProfileType` union literal (replace with `string`); redefine `ProfileConfig` to be an API DTO shape (incl. theme fields).
- Phase 2 — API client method: `getProfileTypes()` (+ `getParameterTypes()` and/or `getGrowthIndicators()` if needed).
- Phase 3 — `ProfileContext` refactor: fetch on session load, cache in memory, expose the same `useProfile()` shape from the API payload.
- Phase 4 — Consumer touch-up: `ProfileDropdown`, any page that reads `profileConfig.parameters`, `profileConfig.theme`, `profileConfig.icon` etc.
- Phase 5 — **Delete `frontend/src/config/profiles/` directory in full.** Verify no remaining imports.
- Phase 6 — Manual browser smoke: log in, see profile dropdown render from API, navigate Overview/Historical with correct theme + icons.

### Part 3 — Polish / consolidation (placeholder)

Reserved. Likely candidates:

- Tighten Project change form UX (inline `ProjectParameterSetting` editor with a friendly threshold widget).
- Improve theme colour picker UX in Django admin (HTML color input vs free text).
- Documentation cleanups (ERD / class diagram updates).

Parts beyond 3 will be added if the work calls for them.

---

## Engineering rules (carry-over from CLAUDE.md, applied to this arc)

- One checklist item per edit. Track in the phase doc immediately.
- Schema-first: SQL files lead, models follow. Both repos use drop-and-recreate locally.
- Two-repo flow: implement on learning, smoke, port to prod on user signal, then commit on learning.
- No auto-commits on prod. Per-action approval for any git-state op on prod.
- No tests in scope; rely on `manage.py check` + scratch DB load + browser smoke per phase.
- FE: rely on `tsc --noEmit -p tsconfig.app.json` clean per phase.

---

## Phase / Part status

```text
Part 1 (Backend consolidation + module ownership reshape)  TODO  -> part_1/ (to be created)
  Phase 1 (SQL clean-up + theme columns)                  TODO
  Phase 2 (ProfileType + Project refinement)              TODO
  Phase 3 (Model relocation + GrowthIndicator)            TODO
  Phase 4 (Cross-module FK + import sweep)                TODO
  Phase 5 (Admin + serializer migration)                  TODO
  Phase 6 (Project admin shape — CRUD)                    TODO
  Phase 7 (Views + URLs)                                  TODO
  Phase 8 (Seed theme data for existing profiles)         TODO
  Phase 9 (Smoke)                                         TODO
  Phase 10 (Docs)                                         TODO
Part 2 (Frontend consolidation)                           TODO  -> part_2/ (after Part 1)
Part 3 (Polish)                                           TBD
```

---

*Last updated: 2026-05-22*
