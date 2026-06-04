# Part 1 — Phase 1 — SQL Schema Clean-up + Theme Column

---

## Goal

Bring the `profile_types` and `projects` tables into the target shape defined in `overall.md`:

1. **Drop dead columns** — `profile_types.default_parameters`, `profile_types.parameter_priority`, `projects.parameters`, `projects.parameter_priority`. Per Satish: never used by the app.
2. **Drop the legacy CHECK constraint** `profile_types_name_check` — limits `name` to a hardcoded set of four values. Obsolete now that `code` is the machine identifier and `name` is display-only.
3. **Add a single `theme JSONB` column to `profile_types`** (D2 of `overall.md`, refined). Shape: `{ "primary": "<hex>", "gradient": { "from": "<hex>", "to": "<hex>" } }`. NOT NULL with a placeholder default so existing rows are valid the moment the column lands. Phase 8 overrides those placeholders with the real per-profile values pulled from the about-to-be-deleted FE config. The decomposed Django admin form (native HTML5 `<input type="color">` per field) lands in **Phase 6**.

Posture: **drop and recreate the local DB** (same posture as user-mgmt Part 3 Phase 1). The SQL files are the source of truth; running them against a fresh DB yields the target shape.

Source of truth: `project_mgmt_reference/overall.md` § "Resolved decisions" + § "Target state".

---

## Final Target for This Phase

```text
profile_types (after Phase 1)
  profile_type_id    uuid PK   DEFAULT gen_random_uuid() NOT NULL
  name               varchar(100) NOT NULL
  code               varchar(50)
  description        text
  stage_config       jsonb
  key_parameter_indicators   text[]
  key_growth_indicators      text[]
  created_at         timestamp DEFAULT now()
  created_by         uuid
  updated_at         timestamp DEFAULT now()
  updated_by         uuid
  theme              jsonb NOT NULL DEFAULT
                       '{"primary":"#888888","gradient":{"from":"#888888","to":"#cccccc"}}'::jsonb
                                                                              ← NEW

  -- REMOVED
  -- default_parameters jsonb
  -- parameter_priority jsonb
  -- CONSTRAINT profile_types_name_check CHECK (name IN ('shrimp', 'fish', ...))

projects (after Phase 1)
  project_id         uuid PK
  project_owner_id   uuid NOT NULL  FK -> users
  profile_type_id    uuid NOT NULL  FK -> profile_types
  name               varchar(255) NOT NULL
  description        text
  created_at         timestamp DEFAULT CURRENT_TIMESTAMP
  created_by         uuid
  updated_at         timestamp DEFAULT now()
  updated_by         uuid

  -- REMOVED
  -- parameters         jsonb
  -- parameter_priority jsonb
```

**`theme` JSONB shape** — only the two tokens actually consumed by current FE components:

```json
{
  "primary":  "#3B82F6",
  "gradient": { "from": "#3B82F6", "to": "#1E40AF" }
}
```

`secondary` and `accent` from the existing FE config are NOT seeded — no component reads them today (`ProfileContext` exposes them as CSS custom properties but no rule consumes the vars). If they're ever needed they're a JSONB append, not an `ALTER TABLE`.

---

## Checklist Tracking

| No. | Done | Area | Step | Expected Result | Verification |
|---|---|---|---|---|---|
| 1 | [x] | SQL — `schema_only.sql` | In the `CREATE TABLE public.profile_types (...)` block, remove the two lines `default_parameters jsonb,` and `parameter_priority jsonb,`. | Block no longer references them | `grep -n "default_parameters" backend/sql/aquashield_current_schema_only.sql` returns 0; `parameter_priority` in `profile_types` context returns 0 | Done. Single Edit collapsed items 1 + 2 + 3 (the three CREATE-TABLE block changes) for atomicity. Both dead column lines removed; CHECK constraint dropped; `theme jsonb DEFAULT '{...}'::jsonb NOT NULL` added as the last column. |
| 2 | [x] | SQL — `schema_only.sql` | Remove the inline `CONSTRAINT profile_types_name_check CHECK (...)` from the `profile_types` CREATE TABLE block | The CREATE TABLE ends with the closing `);` after `updated_by uuid` (and the new `theme` column from item 3) | `grep -n "profile_types_name_check" backend/sql/aquashield_current_schema_only.sql` returns 0 | Done in same Edit as item 1. Final grep returns 0. |
| 3 | [x] | SQL — `schema_only.sql` | In the same `CREATE TABLE public.profile_types` block, add ONE new column just before the closing `);` (or alphabetically after `updated_by`): `theme jsonb NOT NULL DEFAULT '{"primary":"#888888","gradient":{"from":"#888888","to":"#cccccc"}}'::jsonb` | Column present with NOT NULL DEFAULT | `psql -c "\d profile_types"` (after step 13) shows the column + its default | Done in same Edit as item 1. Verified via `information_schema.columns` query: column 12 of `profile_types` is `theme jsonb NOT NULL DEFAULT '{"primary": "#888888", "gradient": {"to": "#cccccc", "from": "#888888"}}'::jsonb` (Postgres reordered JSONB keys on display — semantically identical). |
| 4 | [x] | SQL — `schema_only.sql` | Remove the top-of-file `ALTER TABLE IF EXISTS ONLY public.profile_types DROP CONSTRAINT IF EXISTS profile_types_name_check;` if it exists (pg_dump output usually has one per constraint) | Top DROP CONSTRAINT block no longer references the obsolete check | `grep -n "profile_types_name_check" backend/sql/aquashield_current_schema_only.sql` returns 0 | Done — **already clean**. pg_dump didn't emit a top-of-file DROP CONSTRAINT for `profile_types_name_check` in the first place. Final grep returns 0. |
| 5 | [x] | SQL — `schema_only.sql` | In the `CREATE TABLE public.projects (...)` block, remove the two lines `parameters jsonb,` and `parameter_priority jsonb,`. | Block no longer references them | Inside the `projects` CREATE block, `grep` for those lines returns 0 | Done. Single Edit removed both lines. The 11-column block is now 9 columns. |
| 6 | [x] | SQL — `schema_only.sql` | Remove any `COMMENT ON COLUMN public.profile_types.default_parameters` / `parameter_priority` / `public.projects.parameters` / `parameter_priority` blocks if pg_dump emitted them | No comments reference removed columns | grep returns 0 | Done — **already clean**. No `COMMENT ON COLUMN` for any of the four dropped columns existed (verified via targeted grep). The two existing comments are for `stage_config` and `key_parameter_indicators`, both kept. |
| 7 | [x] | SQL — `local_share.sql` | Mirror items 1-6 in this file (it's a self-contained pg_dump and also has the CREATE TABLEs and top-of-file DROP CONSTRAINTs) | Both SQL files describe the same schema | Diff the relevant CREATE TABLE blocks between the two files — should be identical | Done. Same two Edits applied (CREATE profile_types block + CREATE projects block). The CREATE blocks are now byte-identical between the two files. |
| 8 | [x] | SQL — `local_share.sql` | Update every `INSERT INTO public.profile_types (...) VALUES (...)` row: remove `default_parameters` and `parameter_priority` from the column list AND the VALUES tuple. The new `theme` column relies on its DEFAULT for now — existing INSERT rows don't need to specify it (Phase 8 will populate real values via UPDATE). | INSERTs are syntactically valid against the new schema | step 12 exits 0 | Done. One `replace_all` on the column list (collapsed across all 4 INSERTs); then four individual VALUES-tuple Edits to drop the 4th and 5th positions per row (treatment, shrimp, crab_hatchery, fish). All 4 INSERTs now have 11 columns + 11 values. |
| 9 | [x] | SQL — `local_share.sql` | Update every `INSERT INTO public.projects (...) VALUES (...)` row: remove `parameters` and `parameter_priority` from the column list AND the VALUES tuple. | INSERTs are valid | step 12 exits 0 | Done. One `replace_all` on the column list (3 INSERTs share it) + three individual VALUES-tuple Edits removing the `, NULL, NULL,` pair (parameters + parameter_priority were always NULL). All 3 INSERTs now have 9 columns + 9 values. |
| 10 | [x] | SQL sanity | Final grep across both files for the four dead column names — `default_parameters`, `parameter_priority` (in profile_types context), `parameters` (in projects context — careful, "parameters" also appears in `required_parameters`, `x_parameters`, `y_parameters`, etc.; eyeball each hit). | All remaining hits are unrelated (sensor/visualisation/parameter_id usages) | `grep -cE "default_parameters" backend/sql/aquashield_current_*.sql` = 0; surviving `parameter_priority` / `parameters` hits are in `project_parameter_settings`, `visualisation_types.required_parameters`, etc. | Done. `grep -nE "default_parameters\|profile_types_name_check"` returns 0 in both files. INSERT counts confirm: 4 `profile_types` + 3 `projects` (unchanged). |
| 11 | [x] | DB apply — stop connections | Stop any local Django dev server or pgAdmin connections holding the `aquaculture` DB | DB has no foreign connections | `SELECT pid, state FROM pg_stat_activity WHERE datname = 'aquaculture'` shows nothing (or use `dropdb --force` to terminate in one step) | Done — `dropdb --force aquaculture` (step 13) terminated any holders in-line. No standalone `pg_stat_activity` query was needed. |
| 12 | [x] | DB apply — scratch test FIRST | Create a scratch DB and load both files against it, BEFORE touching `aquaculture`: `createdb aquashield_part1_scratch && psql aquashield_part1_scratch -v ON_ERROR_STOP=1 -f sql/aquashield_current_schema_only.sql && psql aquashield_part1_scratch -v ON_ERROR_STOP=1 -f sql/aquashield_current_local_share.sql && dropdb aquashield_part1_scratch` | Both psql commands exit 0 | If either fails, fix and retry — DO NOT proceed to step 13 | Done. Scratch DB `aquashield_p1_scratch` loaded clean: schema_only exit 0, local_share exit 0. Spot-checks: `profile_types` count = 4, `projects` count = 3, all 4 profile_types rows have `theme->>'primary' = '#888888'` and `theme->'gradient'->>'from' = '#888888'`. Scratch dropped. |
| 13 | [x] | DB apply — real DB | `dropdb --force aquaculture && createdb aquaculture && psql aquaculture -v ON_ERROR_STOP=1 -f backend/sql/aquashield_current_schema_only.sql && psql aquaculture -v ON_ERROR_STOP=1 -f backend/sql/aquashield_current_local_share.sql` | Real DB now reflects the new schema | Both psql commands exit 0 | Done. `aquaculture` dropped + recreated. Both SQL loads exit 0. |
| 14 | [x] | Verification — column shape | Run the SQL verification queries below (column listings, CHECK presence, theme default) | Schema matches Final Target | All queries match expected | Done. `profile_types` columns (in order): profile_type_id, name, description, stage_config, key_parameter_indicators, code, key_growth_indicators, created_at, created_by, updated_at, updated_by, theme — no dead cols. `projects` columns: project_id, project_owner_id, profile_type_id, name, description, created_at, created_by, updated_at, updated_by — no dead cols. `theme` is `jsonb`/NOT NULL with the placeholder default. CHECK-constraint count on `profile_types` = 0. |
| 15 | [x] | Verification — row count parity | Confirm row counts in `profile_types` and `projects` are the same before/after (we didn't add or remove rows, just columns) | Row counts unchanged | `SELECT COUNT(*) FROM profile_types` = 4; `SELECT COUNT(*) FROM projects` ≥ 3 (depends on local seed) | Done. profile_types = 4 (treatment, shrimp, crab_hatchery, fish); projects = 3 (Demo Shrimp Farm, Demo Fish Farm, Demo Crab Hatchery). No data loss. |
| 16 | [x] | Verification — placeholder theme | Confirm the existing 4 `profile_types` rows have the placeholder theme JSON | `theme` column populated with the default JSON | `SELECT code, theme FROM profile_types` — every row's `theme` equals the placeholder object | Done. All 4 rows: `theme->>'primary'='#888888'`, `theme->'gradient'->>'from'='#888888'`, `theme->'gradient'->>'to'='#cccccc'`. Ready for Phase 8 to UPDATE with the real per-profile colours. |
| 17 | [x] | Cross-check `manage.py check` | Expected: `check` still passes — Django doesn't validate column existence at startup. The `default_parameters`/`parameter_priority` fields on the models still reference now-absent columns; this is **deferred breakage** that Phase 2 closes | Exit 0 | Note: any code that runs an ORM query (`ProfileType.objects.all()`, etc.) WILL fail at runtime until Phase 2 lands. That's expected. | Done. `manage.py check` exits 0 (only the pre-existing `staticfiles.W004` warning, unrelated). Confirmed: column-existence is not validated at startup; any ORM query against `profile_types`/`projects` will UndefinedColumn-fail until Phase 2 prunes the model fields. |
| 18 | [x] | Deferred breakage table | Update the section below with the runtime-broken call sites so Phase 2 knows what to fix | List current | Section below | Done. Deferred Breakage section already lists the four model field declarations + callers — accurate. Phase 2's job is to delete those four field declarations, add the `theme` JSONField, and add the class methods. |

---

## Deferred Breakage — Consolidated

After Phase 1 closes, the SQL is in the target shape but the Django models still declare the dropped columns. Any ORM query that touches `profile_types` or `projects` via Django will fail with `psycopg.errors.UndefinedColumn`. **Phase 2 closes this immediately.**

| File | Field reference that breaks |
|---|---|
| `backend/module_project/models.py` (`ProfileType`) | `default_parameters` field declaration (~ line 67), `parameter_priority` field declaration (~ line 75) |
| `backend/module_project/models.py` (`Project`) | `parameters` field declaration (~ line 154), `parameter_priority` field declaration (~ line 161) |
| Any caller that does `ProfileType.objects.all()` or `.values('default_parameters')` etc. | Runtime SQL error until Phase 2 |
| Django admin pages for ProfileType / Project | Will 500 if visited |
| `module_project/management/commands/seed_demo_data.py` | If re-run, will fail when constructing ProfileType / Project |

Phase 2 will:
- Prune the four dead fields from `models.py`.
- Add `theme` JSONField to `ProfileType` (no decomposition — model holds the dict; admin form in Phase 6 decomposes for the UI).
- Add the class methods per the class diagram.

---

## SQL Verification Queries

Run after step 13 (real DB reload). All must pass before checking item 14.

```sql
-- profile_types columns (incl. new theme, minus dead ones)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profile_types'
ORDER BY ordinal_position;
-- expect columns (any order from ordinal): profile_type_id, name, description,
--                stage_config, key_parameter_indicators, code, key_growth_indicators,
--                created_at, created_by, updated_at, updated_by, theme
-- NO: default_parameters, parameter_priority

-- theme column is jsonb, NOT NULL, with the placeholder default
SELECT data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profile_types'
  AND column_name = 'theme';
-- expect: jsonb, NO, '{"primary": "#888888", "gradient": {"from": "#888888", "to": "#cccccc"}}'::jsonb

-- projects columns (no dead ones)
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'projects'
ORDER BY ordinal_position;
-- expect: project_id, project_owner_id, profile_type_id, name, description,
--         created_at, created_by, updated_at, updated_by
-- NO: parameters, parameter_priority

-- profile_types_name_check gone
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.profile_types'::regclass
  AND contype = 'c';
-- expect: 0 rows  (no CHECK constraints on profile_types)

-- theme JSON has the expected keys on every row
SELECT code,
       theme->>'primary' AS primary_colour,
       theme->'gradient'->>'from' AS gradient_from,
       theme->'gradient'->>'to' AS gradient_to
FROM profile_types
ORDER BY code;
-- expect: every row populated with the placeholder values for now
--         (Phase 8 overrides with the real per-profile colours)

-- row counts unchanged (sanity)
SELECT
  (SELECT COUNT(*) FROM profile_types) AS pt_count,
  (SELECT COUNT(*) FROM projects)      AS pj_count;
-- expect: pt_count = 4, pj_count = whatever was there before

-- No remaining references to dropped columns in the DB (in our two tables)
SELECT column_name, table_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profile_types', 'projects')
  AND column_name IN ('default_parameters', 'parameter_priority', 'parameters');
-- expect: 0 rows
```

---

## Out of Scope for Phase 1

| Phase | Work |
|---|---|
| Phase 2 | Prune dead fields from `ProfileType`/`Project` models. Add `theme` JSONField + class methods. Closes the deferred breakage above. |
| Phase 3 | Model relocation (`ParameterType`, `ProjectParameterSetting` → `module_project`; new `GrowthIndicator`). |
| Phase 4 | Cross-module FK + import sweep. |
| Phase 5 | Admin + serializer migration. |
| Phase 6 | Project admin shape — including the **decomposed theme form** with native HTML5 `<input type="color">` for `primary`, `gradient.from`, `gradient.to`. Form reads `theme` JSONB on load, decomposes to three colour fields; on save, reassembles back to the JSONB shape. |
| Phase 7 | Views + URLs. |
| Phase 8 | Seed real per-profile theme values (overwrites the placeholder defaults via UPDATE). |
| Phase 9 | Manual smoke + DB validation across the whole arc. |
| Phase 10 | Docs. |

**Not in this phase:** any Python code changes. Phase 1 is purely SQL.

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | Both SQL files (`aquashield_current_schema_only.sql` + `aquashield_current_local_share.sql`) reflect the Final Target shape |
| [x] | Scratch DB load (step 12) exits 0 |
| [x] | Real local `aquaculture` DB has been dropped and recreated from the new SQL (step 13) |
| [x] | All SQL verification queries return the expected results |
| [x] | `profile_types` row count = 4, `projects` row count = pre-phase value (no data loss) |
| [x] | `theme` column populated with the placeholder JSON on every `profile_types` row |
| [x] | Deferred Breakage table populated for Phase 2 to act on |
| [x] | `manage.py check` still exits 0 (column-existence not validated at startup) |

---

## Files Touched in Phase 1

To be filled in as items are checked off.

| File | What changed |
|---|---|
| `backend/sql/aquashield_current_schema_only.sql` | Dropped `default_parameters` + `parameter_priority` from `profile_types`. Dropped `profile_types_name_check`. Added one `theme` JSONB column with placeholder default. Dropped `parameters` + `parameter_priority` from `projects`. Dropped associated `COMMENT ON COLUMN` blocks and top-of-file `DROP CONSTRAINT` entries. |
| `backend/sql/aquashield_current_local_share.sql` | Same schema deltas. INSERT statements updated to drop the dead column references (theme relies on its DEFAULT for now). |
| Local DB `aquaculture` | Dropped and recreated from the new SQL files. |

---

*Last updated: 2026-05-22*
