# Part 1 — Phase 1 — SQL Schema Patches

---

## Goal

Land the schema additions that the rest of the arc depends on. Strictly SQL — no Python touched. After this phase the DB has:

- `ponds.status` tightened: `NOT NULL` + a CHECK enforcing the 5-state enum from D1.
- Audit columns (`created_by`, `updated_by`) added on `ponds`, `cycle_daily_health`, `cycle_stage_metrics`.
- Audit columns (`updated_at`) added on `cycle_daily_health`; (`created_at`, `updated_at`) added on `cycle_stage_metrics`.
- `cycles` left alone — already complete from a prior arc.

Phase 1 deliberately **does not** touch Python models / admin / serializers / views. Those changes happen in Phase 2 and downstream.

---

## Why now / What changed in the audit

A live `\d` walkthrough showed the DB is partially ahead of the Django models. Specifically:

| Table | Already has (DB) | Missing |
|---|---|---|
| `ponds` | `status varchar(20)` (default `'active'`, but NULL-able + no CHECK), `created_at`, `updated_at` | `status` NOT NULL + CHECK; `created_by`, `updated_by` |
| `cycles` | All 4 audit cols + `chk_cycles_status` CHECK already in place ✅ | nothing — out of scope |
| `cycle_daily_health` | `created_at` + `chk_cycle_daily_health_status` (excellent/good/fair/poor/future) ✅ | `updated_at`, `created_by`, `updated_by` |
| `cycle_stage_metrics` | `metric_id`, `cycle_id`, `stage_name`, `metrics`, `calculated_at` (kept — semantically "last recomputed") | `created_at`, `updated_at`, `created_by`, `updated_by` |

Treatment + PondTreatment already have full audit columns + appropriate FKs (added in the earlier project_mgmt arc that introduced the tables). No work needed there in Phase 1.

CycleDailyHealth's CHECK on `health_status` already encodes the implicit enum (`excellent | good | fair | poor | future`). Phase 1 does **not** rewrite it. The Django-side `choices=` mirror is a Phase 3 task.

---

## Deliverables

**Single file**: `backend/sql/module_pond_phase_1.sql` — runnable incremental migration. Transactional. Idempotent. Designed to apply cleanly on top of a DB freshly loaded from `aquashield_current_local_share.sql`.

The seed files (`aquashield_current_schema_only.sql` + `aquashield_current_local_share.sql`) **stay frozen**. Colleague workflow:

1. Drop + recreate DB.
2. Load `aquashield_current_local_share.sql` (baseline).
3. Run `module_pond_phase_1.sql` (this phase).
4. *Future*: `module_pond_phase_2.sql`, `module_pond_phase_3.sql`, … as each phase adds more SQL.

---

## Target SQL (preview)

```sql
BEGIN;

-- ─── ponds.status: NOT NULL + 5-state CHECK ───
-- Backfill any defensive NULL → 'active' (default is already 'active'; no NULLs expected).
UPDATE public.ponds SET status = 'active' WHERE status IS NULL;
ALTER TABLE public.ponds ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.ponds DROP CONSTRAINT IF EXISTS chk_ponds_status;
ALTER TABLE public.ponds
    ADD CONSTRAINT chk_ponds_status
    CHECK (status IN ('active', 'draining', 'cleaning', 'maintenance', 'decommissioned'));

-- ─── ponds: created_by + updated_by ───
ALTER TABLE public.ponds
    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL;
ALTER TABLE public.ponds
    ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL;

-- ─── cycle_daily_health: updated_at + created_by + updated_by ───
ALTER TABLE public.cycle_daily_health
    ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT now();
ALTER TABLE public.cycle_daily_health
    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL;
ALTER TABLE public.cycle_daily_health
    ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL;

-- ─── cycle_stage_metrics: created_at + updated_at + created_by + updated_by ───
-- calculated_at stays — it carries "when this metric snapshot was last recomputed".
ALTER TABLE public.cycle_stage_metrics
    ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT now();
ALTER TABLE public.cycle_stage_metrics
    ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT now();
ALTER TABLE public.cycle_stage_metrics
    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL;
ALTER TABLE public.cycle_stage_metrics
    ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL;

COMMIT;
```

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | Write `backend/sql/module_pond_phase_1.sql` | Full migration written with `BEGIN/COMMIT`, inline `why` comments per section. | done |
| 2 | [x] | Apply against scratch DB cloned from current seed | First run: `COMMIT`, exit 0. Only NOTICE: "constraint chk_ponds_status does not exist, skipping" — expected (the `DROP IF EXISTS` runs before the first-time ADD). | ✅ |
| 3 | [x] | Verify post-migration shape | `\d ponds` shows `status NOT NULL`, `chk_ponds_status` CHECK with 5 values, `created_by` + `updated_by` FKs to users. `cycle_daily_health` gains `updated_at`/`created_by`/`updated_by`. `cycle_stage_metrics` gains `created_at`/`updated_at`/`created_by`/`updated_by` (with `calculated_at` preserved). | ✅ |
| 4 | [x] | Idempotency check | Re-running on the same DB → `COMMIT`, exit 0. All ADD COLUMNs reported "already exists, skipping" via the `IF NOT EXISTS` clause; the constraint drop+re-add is a no-op net change. | ✅ |
| 5 | [x] | `manage.py check` | Exit 0; only the pre-existing staticfiles.W004 warning. | ✅ |

---

## Verification Block — to run after item 1

```bash
export PGPASSWORD='aquaculture'

# Build a scratch DB at the CURRENT pre-phase-1 state from the seed file
dropdb -h localhost -U postgres --if-exists --force test_pond_phase1
createdb -h localhost -U postgres test_pond_phase1
psql -h localhost -U postgres -d test_pond_phase1 -v ON_ERROR_STOP=1 -q \
    -f backend/sql/aquashield_current_local_share.sql

# Apply the migration
psql -h localhost -U postgres -d test_pond_phase1 -v ON_ERROR_STOP=1 \
    -f backend/sql/module_pond_phase_1.sql

# Inspect resulting shape
psql -h localhost -U postgres -d test_pond_phase1 <<'SQL'
\d ponds
\d cycle_daily_health
\d cycle_stage_metrics
SQL
```

Expected:
- Migration runs to `COMMIT`.
- `ponds.status` is `NOT NULL`, has `chk_ponds_status` CHECK with the 5 values.
- `ponds`, `cycle_daily_health`, `cycle_stage_metrics` all carry the new columns.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| Existing `ponds.status` row has a value outside the 5-state enum | The defensive `UPDATE ... WHERE status IS NULL` handles NULLs. For non-NULL out-of-range values: we run a sanity query before the CHECK lands (see Verification Block). If any exist, the migration would fail at CHECK time — the BEGIN/COMMIT ensures rollback. |
| FK to `users(user_id)` for `created_by`/`updated_by` could fail if the `users` table doesn't exist on the target DB | At the current schema state, `users` exists. For colleagues running this against an older snapshot that pre-dates `users`, they'd run the colleague migration script first (`aquashield_schema_20260522_update.sql`), then this. Documented in script header. |
| Adding a column with a default on a large existing table can lock the table briefly | Tables here are small (≤41 rows for ponds/etc.). Acceptable. For prod-scale this would need `ADD COLUMN ... DEFAULT ... NOT VALID` + a follow-up VALIDATE step. Out of scope. |
| `cycle_stage_metrics.calculated_at` could be redundant once `updated_at` exists | Kept for backward semantic — `calculated_at` is "when this stage's metric was recomputed", `updated_at` is "when the row was last touched at all". They diverge if we ever rewrite metadata without recomputing. Out of scope to reconcile. |

---

## Out of scope for Phase 1

| Item | Where it lands |
|---|---|
| Updating `module_pond/models.py` to declare the new fields | Phase 2 |
| Wiring `choices=` on `CycleDailyHealth.health_status` (CHECK is already in DB) | Phase 3 |
| Admin updates (filters, edit_link, JSON widgets) | Phase 4 |
| Serializers / views | Phases 5 + 6 |
| Treatment / PondTreatment seed | Phase 7 |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `backend/sql/module_pond_phase_1.sql` exists and applies cleanly on top of a fresh DB loaded from `aquashield_current_local_share.sql` |
| [x] | Post-migration `\d` shows all expected columns + the `chk_ponds_status` CHECK |
| [x] | Migration is idempotent — re-running against the same DB also commits clean |
| [x] | `python manage.py check` exits 0 |
| [x] | Seed files (`aquashield_current_schema_only.sql`, `aquashield_current_local_share.sql`) **untouched** |

---

## Files Touched in Phase 1

| File | What changed |
|---|---|
| `backend/sql/module_pond_phase_1.sql` (new) | Incremental migration: status tightening + audit cols on ponds + cycle_daily_health + cycle_stage_metrics. |

The seed files (`aquashield_current_schema_only.sql`, `aquashield_current_local_share.sql`) are **not touched** in this arc. The migration assumes a fresh DB loaded from the current seed and applies forward.

---

*Last updated: 2026-05-23*
