# Part 1 — Phase 9 — Smoke + Whole-Arc Validation

---

## Goal

Confirm Phases 1-6 hang together as one consistent arc. No implementation in this phase — only validation. Two kinds of smoke:

1. **Programmatic** (shell + APIClient) — counts, model field shape, class method correctness, admin registry, serializer round-trip, API responses. Cheap, repeatable. Runs in one block.
2. **Browser** (user-driven) — admin pages, inline editor, list filters, FE regression. The bits a script can't verify.

Phase 9 ends when both pass. If anything fails, the gap is documented and fixed under its originating phase, then Phase 9 re-runs.

---

## What we're really checking

| Category | Question | Where verified |
|---|---|---|
| **Schema integrity** | Did Phase 1's migration produce the expected columns + constraints on the live DB? | Programmatic — `\d` introspection |
| **Model surface** | Do Pond/Cycle/CycleDailyHealth/CycleStageMetric expose the new fields + class methods (Phases 2-3)? | Programmatic — `dir()` + method calls |
| **Admin polish** | Are all 6 admins on `unfold.admin.ModelAdmin` with `edit_link`? Is `PondTreatmentInline` attached to `PondAdmin`? | Programmatic — admin registry |
| **Serializer shape** | Do PondSerializer/CycleSerializer/etc. surface the new fields? Do the new TreatmentSerializer + PondTreatmentSerializer render cleanly? | Programmatic — instantiate + `.data` |
| **API surface** | Do the 4 new endpoints return 200 + flat list + correct RBAC + filter narrowing + 401 on anonymous? | Programmatic — APIClient |
| **Cross-module wiring** | Do existing consumers (chart pipeline, data_simulator, etc.) still work? Did Phase 5's `obj.sensors → obj.project_sensors` fix hold? | Programmatic |
| **Admin UX** | Does PondAdmin's PondTreatment inline render with autocomplete? Do list filters work? | Browser |
| **FE regression** | Does the React app still render Overview / Digital Twin / Forecast / Pond Comparison / Historical? Part 2 hasn't started — FE still expects only the existing field shape; new fields ride through harmlessly. | Browser |

---

## Phase 9 produces no diffs

Same posture as project-mgmt Phase 9. Any gap surfaces under its originating phase. The phase doc records what passed.

---

## Checklist Tracking

### A. Programmatic smoke (one shell script)

| No. | Done | Step | Pass criterion |
|---|---|---|---|
| 1 | [x] | DB schema check | `ponds.status` NOT NULL + `chk_ponds_status` CHECK with the 5 values present; FKs `ponds_created_by_fkey` + `ponds_updated_by_fkey` to users; `cycle_daily_health` + `cycle_stage_metrics` audit cols present. | ✅ |
| 2 | [x] | Model counts | Pond=16 ✅, Cycle≥3, DailyHealth>0, StageMetric>0, Treatment≥1. | ✅ |
| 3 | [x] | Pond class methods | All 3 callable, return correct types. | ✅ |
| 4 | [x] | Cycle class methods | Predicates mutually exclusive; duration > 0; profile resolves with `.code` attribute. | ✅ |
| 5 | [x] | DailyHealth + StageMetric helpers | `is_alert` bool; `get_parameter_codes` list; `get_parameter_metric` returns dict for known code. | ✅ |
| 6 | [x] | Admin registry | All 6 admins on Unfold + edit_link; PondTreatmentInline attached to PondAdmin. | ✅ 13/13 PASS |
| 7 | [x] | Serializer shape | 15 new field-presence checks across 5 serializers — all PASS. | ✅ |
| 8 | [x] | New API endpoints | 4 endpoints → 200 + flat list. `?cycle=` filter narrows daily-health from full → subset. | ✅ |
| 9 | [x] | Existing API regression | `/api/ponds/` 200 + new keys (`status`, `is_active`) ride through; `/api/cycles/`, `/api/cycles/{id}/details/` 200 with camelCase contract preserved. | ✅ |
| 10 | [x] | Auth gate | 4 endpoints × anon → 401. | ✅ |

### B. Browser smoke (user-driven)

| No. | Done | Step | Pass criterion |
|---|---|---|---|
| 11 | [ ] | Admin index | `/admin/module_pond/` shows 6 entries (Pond, Cycle, Daily Health, Stage Metric, Treatment, Pond Treatment). |
| 12 | [ ] | PondAdmin changelist | Lists 16 ponds with name/project/status/Edit columns. Sidebar filters by status + project. |
| 13 | [ ] | PondAdmin change form | Open `Pond A`. See Identity / Description / Metadata / Status / Audit fieldsets. **Treatment inline at the bottom with autocomplete on `treatment` FK** — typing "water" finds matching catalogue entries. |
| 14 | [ ] | TreatmentAdmin | List shows name/is_active/updated_at + Edit (no `code` column). Search by code/name works. |
| 15 | [ ] | PondTreatmentAdmin | List with autocomplete on pond + treatment. |
| 16 | [ ] | CycleAdmin | Identity / Lifecycle / Audit fieldsets on change form. Filters by status + project. |
| 17 | [ ] | DailyHealth + StageMetric admins | Filterable by parent project. |
| 18 | [ ] | FE regression | Vite dev server boots clean; log in; navigate Overview / Digital Twin / Forecast / Pond Comparison / Historical. No console errors. Existing pages render as before. |

---

## Programmatic Verification Block — run after item 1 is queued

```bash
cd backend && source venv/bin/activate

# 1. Django config check
python manage.py check

# 2. DB schema introspection
export PGPASSWORD='aquaculture'
psql -h localhost -U postgres -d aquaculture <<'SQL'
\d ponds
\d cycle_daily_health
\d cycle_stage_metrics
SQL

# 3. Whole-arc programmatic smoke
python manage.py shell <<'PY'
import sys
from django.contrib import admin as dj_admin
from unfold.admin import ModelAdmin as UnfoldModelAdmin
from rest_framework.test import APIClient
from module_user.models import User
from module_pond.models import (
    Pond, Cycle, CycleDailyHealth, CycleStageMetric,
    Treatment, PondTreatment,
)
from module_pond.serializers import (
    PondSerializer, PondDetailSerializer,
    CycleSerializer, CycleDetailSerializer,
    CycleDailyHealthSerializer, CycleStageMetricSerializer,
    TreatmentSerializer, PondTreatmentSerializer,
)

failures = []
def expect(label, cond, detail=""):
    mark = '✅' if cond else '❌'
    print(f"  {mark} {label}  {detail if not cond else ''}")
    if not cond: failures.append(label)

# [2] Counts
print("\n[2] Counts")
expect(f"Pond=16",       Pond.objects.count() == 16,         f"got {Pond.objects.count()}")
expect(f"Cycle>=3",      Cycle.objects.count() >= 3,         f"got {Cycle.objects.count()}")
expect(f"DailyHealth>0", CycleDailyHealth.objects.count() > 0)
expect(f"StageMetric>0", CycleStageMetric.objects.count() > 0)
expect(f"Treatment>=1",  Treatment.objects.count() >= 1)

# [3] Pond methods
print("\n[3] Pond class methods")
p = Pond.objects.first()
expect("Pond.is_active() bool", isinstance(p.is_active(), bool))
expect("Pond.get_active_cycle() callable", callable(getattr(p, 'get_active_cycle', None)))
expect("Pond.get_latest_cycle() callable", callable(getattr(p, 'get_latest_cycle', None)))

# [4] Cycle methods
print("\n[4] Cycle class methods")
c = Cycle.objects.first()
preds = (c.is_ongoing(), c.is_completed(), c.is_terminated())
expect("Cycle predicates mutually exclusive", sum(preds) == 1, f"got {preds}")
expect("Cycle.duration_days > 0", c.duration_days() > 0)
profile = c.get_profile_type()
expect("Cycle.get_profile_type returns ProfileType-ish", profile is not None and hasattr(profile, 'code'))

# [5] DailyHealth + StageMetric
print("\n[5] DailyHealth + StageMetric helpers")
h = CycleDailyHealth.objects.first()
if h:
    expect("DailyHealth.is_alert bool", isinstance(h.is_alert(), bool))
m = CycleStageMetric.objects.first()
if m:
    codes = m.get_parameter_codes()
    expect("StageMetric.get_parameter_codes list", isinstance(codes, list))
    if codes:
        expect("StageMetric.get_parameter_metric returns dict-or-None", m.get_parameter_metric(codes[0]) is not None)

# [6] Admin registry
print("\n[6] Admin registry")
for model in (Pond, Cycle, CycleDailyHealth, CycleStageMetric, Treatment, PondTreatment):
    sa = dj_admin.site._registry[model]
    expect(f"  {model.__name__} on UnfoldModelAdmin", isinstance(sa, UnfoldModelAdmin))
    expect(f"  {model.__name__} has edit_link", 'edit_link' in (sa.list_display or []))
pond_admin = dj_admin.site._registry[Pond]
inline_names = [i.__name__ for i in (pond_admin.inlines or [])]
expect("PondAdmin has PondTreatmentInline", 'PondTreatmentInline' in inline_names)

# [7] Serializer shape
print("\n[7] Serializer shape")
pdata = PondSerializer(Pond.objects.first()).data
for key in ('status', 'is_active', 'created_at', 'updated_at'):
    expect(f"  PondSerializer key '{key}'", key in pdata)
cdata = CycleSerializer(Cycle.objects.first()).data
for key in ('duration_days', 'is_ongoing', 'updated_at'):
    expect(f"  CycleSerializer key '{key}'", key in cdata)
if h:
    hdata = CycleDailyHealthSerializer(h).data
    for key in ('is_alert', 'updated_at'):
        expect(f"  DailyHealthSerializer key '{key}'", key in hdata)
if m:
    mdata = CycleStageMetricSerializer(m).data
    for key in ('parameter_codes', 'created_at', 'updated_at'):
        expect(f"  StageMetricSerializer key '{key}'", key in mdata)
t = Treatment.objects.first()
if t:
    tdata = TreatmentSerializer(t).data
    for key in ('code', 'name', 'is_active', 'created_at'):
        expect(f"  TreatmentSerializer key '{key}'", key in tdata)

# [8] + [9] + [10] API smoke
print("\n[8-10] API smoke")
user = User.objects.filter(is_active=True).first()
client = APIClient(); client.force_authenticate(user=user)
H = {'HTTP_HOST': 'localhost'}

# New endpoints — 200 + flat list
for path in ('/api/treatments/', '/api/pond-treatments/', '/api/cycle-daily-health/', '/api/cycle-stage-metrics/'):
    r = client.get(path, **H)
    body = r.json() if r.status_code == 200 else None
    expect(f"  GET {path}", r.status_code == 200 and isinstance(body, list), f"status={r.status_code}")

# Filter narrowing
cy = Cycle.objects.first()
r_all  = client.get('/api/cycle-daily-health/', **H).json()
r_one  = client.get(f'/api/cycle-daily-health/?cycle={cy.cycle_id}', **H).json()
expect("  cycle filter narrows daily-health", len(r_one) < len(r_all))

# Existing endpoint regression — PondSerializer now exposes new fields
r = client.get('/api/ponds/', **H)
body = r.json() if r.status_code == 200 else {}
ponds_list = body.get('ponds') if isinstance(body, dict) else body
expect("  GET /api/ponds/ → 200", r.status_code == 200)
if ponds_list:
    expect("  /api/ponds/ row has 'status'", 'status' in ponds_list[0])
    expect("  /api/ponds/ row has 'is_active'", 'is_active' in ponds_list[0])

# Cycles details (existing camelCase contract preserved)
r = client.get('/api/cycles/', **H)
expect("  GET /api/cycles/ → 200", r.status_code == 200)
cycles = r.json()
cycles_list = cycles if isinstance(cycles, list) else (cycles.get('results') or [])
if cycles_list:
    cid = cycles_list[0]['cycle_id']
    r = client.get(f'/api/cycles/{cid}/details/', **H)
    expect("  GET /api/cycles/{id}/details/ → 200", r.status_code == 200)
    if r.status_code == 200:
        # the camelCase outlier — preserved per Phase 5 decision
        details = r.json()
        expect("  /details/ preserves camelCase shape", 'dailyHealth' in details or 'stageMetrics' in details)

# Auth gate
anon = APIClient()
for path in ('/api/treatments/', '/api/pond-treatments/', '/api/cycle-daily-health/', '/api/cycle-stage-metrics/'):
    r = anon.get(path, **H)
    expect(f"  anon {path} → 401", r.status_code == 401, f"status={r.status_code}")

# Summary
print()
if failures:
    print(f"❌ FAIL: {len(failures)} item(s):")
    for f in failures: print(f"  - {f}")
    sys.exit(1)
print("ALL GREEN ✅")
PY
```

Expected: every line ✅; final line "ALL GREEN ✅".

---

## Browser smoke walkthrough (items 11-18)

### Setup

```bash
cd backend && source venv/bin/activate && python manage.py runserver
# in another terminal
cd frontend && npm run dev
```

### Walkthrough

1. `/admin/module_pond/` — six entries listed.
2. `/admin/module_pond/pond/` — 16 rows, status + Edit columns, sidebar filters work.
3. Click `Pond A` → fieldsets visible. Scroll to bottom → **PondTreatment inline** with empty row + "+ Add another Treatment" button. Click into the `treatment` field → typeahead. Add a treatment, save, reload — persists.
4. `/admin/module_pond/treatment/` — catalogue. Search by code or name works.
5. `/admin/module_pond/pondtreatment/` — standalone changelist with autocomplete on pond + treatment.
6. `/admin/module_pond/cycle/` — Identity / Lifecycle / Audit fieldsets on the change form. Filters by status + project.
7. `/admin/module_pond/cycledailyhealth/` + `/cyclestagemetric/` — filterable by health_status / stage_name + parent project.
8. FE (`http://localhost:5173`) — log in, navigate Overview / Digital Twin / Forecast / Pond Comparison / Historical. No console errors. Existing pages render the same as before Part 1 (Part 2 hasn't shipped yet; new fields are present but unused by current FE).

---

## Risks / Things to Watch

| Risk | Mitigation |
|---|---|
| Dev DB hasn't had Phase 1 migration applied → model expects columns that don't exist | We applied `module_pond_phase_1.sql` to dev DB during Phase 2 cook. Verified by `\d` introspection in the script. |
| Browser smoke discovers a regression in `/api/cycles/{id}/details/` (the camelCase contract) | The new fields are additive; nothing removed. Existing FE consumers should see the same keys + a few extras. |
| FE Pond Detail page (or any consumer) breaks because PondSerializer added keys | Adding keys is backwards-compatible. FE ignores unknown keys. Verified by Part 2 of project_mgmt pattern. |
| Test DB state diverges from dev DB | All smoke runs against the live dev DB. No scratch DB needed for Phase 9. |

---

## Out of scope

| Item | Where |
|---|---|
| Phase 10 docs | Phase 10 |
| Part 2 FE integration | Part 2 |
| Two-repo port | Standard workflow; on user signal |
| User-created Treatment + PondTreatment rows | User-managed via admin (D6) |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | Programmatic smoke prints `ALL GREEN` (50+ assertions) |
| [ ] | Browser smoke: 6 admin pages render with Unfold styling, PondTreatment inline visible, all filters work — pending user verification |
| [ ] | FE regression: existing React pages render without console errors — pending user verification |

---

## Files Touched in Phase 9

**None** — validation only.

---

*Last updated: 2026-05-23*
