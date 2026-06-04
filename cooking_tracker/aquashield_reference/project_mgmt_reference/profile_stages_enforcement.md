# Profile ↔ Cycle-Stage Consistency — Enforcement Plan

**Goal:** make `ProfileType.stage_config` the *enforced* single source of truth for growth
stages, and guarantee every cycle's stage data (`CycleStageMetric.stage_name`,
`CycleDailyHealth.day_number`) conforms to it — **entirely at the application layer, no DB
schema changes.**

**Why application-layer:** every relevant model is `managed = False` (schema lives in raw SQL).
So FK/CHECK constraints would mean hand-written SQL migrations — which we are deliberately
avoiding. Validators + model `clean()` + serializer checks + a canonical resolver are the levers.

Legend: `[ ]` todo · `[x]` done · ⚠️ decision needed

---

## 0. Baseline audit (DONE — dev DB `aquaculture`, read-only)

Script: `/tmp/check_profile_stage_consistency.py` (promote to a mgmt command in Phase 4).

**Profiles:** shrimp (4 stages 1–90, list) ✅ · fish (4 stages 1–163, wrapped dict) ✅ ·
crab_hatchery (5 stages 1–192, list) ✅ · **treatment (stage_config = None)** ⚠️ ·
**octopus (stage_config = None)** ⚠️

**Cycles (26):** 0 orphan stage_names · 0 day-range violations/gaps/over-length ·
**11 cycles (6 fish + 5 crab) have NO stage metrics at all** ⚠️ · 15 shrimp fully consistent.

**Conclusion:** existing data is *internally consistent where present* — nothing contradicts
the profiles. Enforcement is therefore **low-risk to enable**; the open questions are only about
empty/missing cases (see Decisions).

Two `stage_config` shapes exist in real data and BOTH must keep working:
- plain list: `[{name, startDay, endDay}, ...]`
- wrapped dict: `{"stages": [...], "cycleLengthDays": N}`

---

## 1. Validate the SOURCE OF TRUTH — `ProfileType.stage_config`

If the profile is well-formed, everything downstream can trust it. Mirror the pattern already
used for `users.feature_action_assigned` (a shape validator in `validators.py` reused by both the
admin form `clean_*` and the DRF serializer).

- [x] **1a. New validator** `_validate_stage_config_shape(value)` → created
  `backend/module_project/validators.py`. Allows None/[]/empty (stage-less); enforces shape,
  unique names, startDay≥1, endDay≥startDay, contiguous+non-overlapping (first startDay==1,
  each startDay==prev.endDay+1), and wrapped `cycleLengthDays == last endDay`.
  Verified: all 5 real profiles PASS; 8 malformed cases rejected; stage-less cases PASS.
- [x] **1b. Wire into the admin** → added `ProfileTypeAdminForm.clean_stage_config` in
  `module_project/forms.py` (hard-reject via ValidationError).
- [~] **1c. DRF** — no-op (viewset read-only). Left unwired by design.
- [x] **1d. DROPPED** per D1 (stage-less valid; no backfill needed).

---

## 2. CENTRALIZE stage resolution — one resolver, no re-derivation

Today the day→stage and cycle-length logic is re-implemented 3× (model helpers [dead], the
`cycles` view inline, the frontend). Collapse the backend copies into the model methods so there
is exactly one authoritative implementation.

- [x] **2a. Canonical resolver** — `ProfileType.get_stages()/get_stage_by_day()/get_cycle_length()`
  are now live (consumed by 2b + 2c). No longer dead code.
- [x] **2b. Refactored `module_project/views.py` `cycles` action** — replaced the inline
  `isinstance(list/dict)` block with `profile.get_stages()` + `profile.get_cycle_length()`.
  Behavior-preserving (post-Phase-1, max endDay == last endDay).
- [x] **2c. Server-resolve per-day stage** — `module_pond/views.py` `details` action now tags each
  daily-health row with `'stageName': profile.get_stage_by_day(day).name` (profile via
  `cycle.get_profile_type()`). Frontend: added `stageName` to `DailyHealth` type and changed
  `HealthStatusOverview.tsx` `stageDailyHealth` to filter by `day.stageName === selectedStage`
  instead of `startDay..endDay`. Verified tagging on real shrimp cycle (day 1→Post-Larvae,
  45→Sub-Adult, 89→Harvest Ready). tsc + eslint clean.

---

## 3. ENFORCE on cycle WRITE (no schema change)

Guard the write path so new/edited cycle data cannot drift from the profile. Because the models
are `managed = False`, this lives in `clean()` / serializer validators / the data pipeline — not
DB constraints.

- [ ] **3a. `CycleStageMetric` validation** — `stage_name` must be one of the parent cycle's
  profile stage names (`cycle.pond.project.profile_type` → `get_stages()` names). Implement in
  model `clean()` and/or the serializer used by seeding/ingestion.
- [ ] **3b. `CycleDailyHealth` validation** — `day_number` must be within
  `1 .. profile.get_cycle_length()` AND fall inside some stage (`get_stage_by_day` not None).
  Note the existing DB CHECK is a fixed `1–192` (crab's max) — app-layer makes it
  *profile-specific* without touching the table.
- [ ] **3c. Apply at the actual writers** — `module_project/management/commands/seed_demo_data.py`
  and any ingestion path that creates these rows. Validate-before-save; decide hard-fail vs
  log-and-skip per ⚠️ D3.

---

## 4. DRIFT DETECTION (ongoing guard)

- [ ] **4a. Promote the audit** `/tmp/check_profile_stage_consistency.py` into a management command,
  e.g. `module_project/management/commands/audit_stage_consistency.py`. Exit non-zero on any
  contradiction (orphan name / out-of-range day) so it can run in CI.
- [ ] **4b. Run it after seeding** and (optionally) on a schedule.

---

## 5. FRONTEND alignment (graceful, authoritative)

- [ ] **5a. Treat server data as authoritative** in `HealthStatusOverview.tsx`; don't crash on
  `profileTemplate == null` (treatment/octopus) or `stageMetrics[selectedStage] == undefined`
  (the 11 metric-less cycles). Show explicit "no stage data" / "no metrics yet" states.
- [ ] **5b. If 2c lands**, consume the server-resolved `stageName` per day instead of
  re-bucketing by `startDay..endDay`.
- [ ] **5c. cycleLengthDays** — keep reading from the server payload (now sourced from
  `get_cycle_length`), not a frontend `|| 90` fallback that can mask a misconfigured profile.

---

## SCOPE (locked) — admin-panel enforcement only

Seed data is **out of scope** (user doesn't care). DRF is read-only. So enforcement attaches to
**one place: `ProfileTypeAdminForm.clean_stage_config`** (Django admin = the only human write path
for `stage_config`). Strictness = **hard-reject** (raise `ValidationError`).

This means the actual work reduces to:
- **Phase 1** — the `stage_config` shape validator + wire into the admin form. ← enforcement
- **Phase 2a** — revive `get_stages`/`get_stage_by_day`/`get_cycle_length` as the canonical resolver
  (prerequisite for 2b + 2c).
- **Phase 2b** — make the `cycles` view (`module_project/views.py:192–211`) use the resolver
  instead of inline shape logic.
- **Phase 2c — NOW IN SCOPE** (user opted in): server-resolve per-day stage. Attach in
  `module_pond/views.py` `details` action (~lines 119–127): for each daily-health row add
  `'stageName': profile.get_stage_by_day(h.day_number) -> name or None`, where
  `profile = cycle.pond.project.profile_type`. Then update `HealthStatusOverview.tsx:95–98` to
  group by `day.stageName` instead of bucketing by `startDay..endDay`. Update `CycleDetails`/
  daily-health TS type to include `stageName`.
- **Phase 3 DROPPED** — cycle stage-data writes are seed/ingestion, not admin; not enforcing.

## Decisions (resolved)

- **D1 — Stage-less profiles (treatment, octopus, `stage_config = None`): ✅ VALID.**
  The validator MUST allow `None`/`[]` as a legitimate "stage-less profile." No backfill needed;
  the stage UI is simply skipped for these. (So Phase 1d is dropped.)
- **D2 — Cycles with no stage metrics (11 fish/crab cycles): ✅ EXPECTED / allowed.**
  Missing metrics is NOT an error. Phase 3 enforces only that *present* data conforms; it never
  requires a metric to exist. "Missing metric" stays out of the enforcement (audit may still
  report it as informational).

## Decisions (resolved, cont.)

- **D3 — Strictness: ✅ HARD-REJECT.** `clean_stage_config` raises `ValidationError`; admin
  blocks save until the config is valid.
- **D4 — Phase 2c (server-resolved per-day stage): ✅ DEFERRED.** It's a frontend/API
  code-duplication cleanup (move the "day → stage" mapping out of `HealthStatusOverview.tsx`
  into the backend), NOT part of enforcement. Keep current frontend bucketing for now.

---

## ⚠️ KEY: write paths for `stage_config` (where enforcement must attach)

| Writer | Through admin form? | Through DRF? | Notes |
|---|---|---|---|
| Django admin (human) | ✅ yes | — | `ProfileTypeAdminForm` + `StageConfigEditorWidget` |
| `seed_demo_data.py` (ORM) | ❌ **NO** | — | writes `stage_config` directly via `.create()/.save()` |
| DRF API | — | **read-only** | `ProfileTypeViewSet` is `ReadOnlyModelViewSet` — no writes |

**Consequence:** putting the validator only in `clean_stage_config` leaves the **seeder path
unguarded**, and `Model.save()`/`.create()` do NOT auto-call `full_clean()`. So the canonical
`_validate_stage_config_shape()` must be invoked from BOTH (1) the admin form `clean_*` AND
(2) the seeder (explicit call, or a `ProfileType.save()` override that validates). Phase 1c (DRF
`validate_stage_config`) is a **no-op today** — only wire it if the viewset ever becomes writable.

---

## Risk note
No contradictory data exists today, so Phases 1–2 are safe to land without breaking current
reads. Phase 3 only affects *future* writes. The only place existing behavior changes is the
empty/missing cases (D1/D2) — handle those first.
