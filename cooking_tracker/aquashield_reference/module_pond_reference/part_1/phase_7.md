# Part 1 — Phase 7 — Seed Data ❌ DROPPED (D6)

> **Status: DROPPED.** Per D6 of `overall.md`, the user opted to create Treatment + PondTreatment data manually via the Django admin (Phase 4 polished the surface for exactly this). No seed SQL produced; no `backend/sql/module_pond_phase_7.sql` exists.
>
> The original plan is preserved below for context — revive only if a future need calls for shipping baseline rows alongside the codebase.

---

## ~~Goal~~ (original — superseded by D6)

Populate the `treatments` catalogue + sample `pond_treatments` rows so:
1. The Pond admin's treatment inline (Phase 4) has dropdown options.
2. `GET /api/treatments/` returns a useful catalogue (currently just 1 row — BioBloc).
3. `GET /api/pond-treatments/?pond=<uuid>` returns non-empty data for at least some demo ponds.
4. The Part 2 FE (Pond Detail page) has data to render in the treatment timeline.

`Pond.status` — **out of scope.** All 16 demo ponds default to `'active'` from Phase 1's `ALTER ... SET NOT NULL DEFAULT 'active'`. Demo variety (`draining` / `cleaning` / etc.) is optional polish; better left for a browser-smoke decision.

---

## What gets seeded

### 5 Treatment catalogue rows

| code | name | description |
|---|---|---|
| `water-change` | Water Change | Partial water exchange to refresh quality + reduce metabolite buildup. |
| `probiotic` | Probiotic Dose | Beneficial bacteria for water quality + gut health. |
| `antibiotic` | Antibiotic Course | Targeted disease treatment with prescribed antibiotics. |
| `liming` | Liming | Calcium hydroxide / carbonate for pH adjustment + disinfection. |
| `vitamin-supplement` | Vitamin Supplement | Nutritional supplement for growth + immune support. |

The existing `BioBloc` row (already in DB) is preserved — total after Phase 7 = **6 treatments**.

### 4 sample PondTreatment rows

| Pond | Treatment | started_at | ended_at | Active? |
|---|---|---|---|---|
| `Pond A` | water-change | today − 7d | NULL (ongoing) | ✅ |
| `Fish Tank A` | probiotic | today − 14d | today − 7d | — |
| `Crab Tank B` | antibiotic | today − 5d | NULL (ongoing) | ✅ |
| `Pond C` | vitamin-supplement | today − 14d | today − 10d | — |

Mix of active + completed gives the FE both states to render. Pond names looked up by name to avoid hardcoding UUIDs.

---

## SQL convention

Same as Phase 1: produce a runnable, idempotent, transactional migration at `backend/sql/module_pond_phase_7.sql`. Forward-only.

Idempotency strategy:
- **Treatments**: `ON CONFLICT (code) DO NOTHING` — code is UNIQUE; second run is a no-op.
- **PondTreatments**: `INSERT ... SELECT ... WHERE NOT EXISTS (...)` guarded by `(pond_id, treatment_id, started_at)` signature.

---

## Target SQL (preview)

```sql
BEGIN;

-- Treatment catalogue
INSERT INTO public.treatments (code, name, description, is_active)
VALUES
    ('water-change',       'Water Change',       '...', true),
    ('probiotic',          'Probiotic Dose',     '...', true),
    ('antibiotic',         'Antibiotic Course',  '...', true),
    ('liming',             'Liming',             '...', true),
    ('vitamin-supplement', 'Vitamin Supplement', '...', true)
ON CONFLICT (code) DO NOTHING;

-- Sample PondTreatment rows (idempotent — NOT EXISTS guard on signature)
INSERT INTO public.pond_treatments (pond_id, treatment_id, started_at, ended_at, notes)
SELECT p.pond_id, t.treatment_id, CURRENT_DATE - INTERVAL '7 days', NULL,
       'Routine 20% water exchange to maintain DO levels.'
FROM public.ponds p, public.treatments t
WHERE p.name = 'Pond A' AND t.code = 'water-change'
  AND NOT EXISTS (
    SELECT 1 FROM public.pond_treatments pt
    WHERE pt.pond_id = p.pond_id
      AND pt.treatment_id = t.treatment_id
      AND pt.started_at = CURRENT_DATE - INTERVAL '7 days'
  );

-- ... 3 more sample PondTreatment INSERTs following the same pattern.

COMMIT;
```

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [ ] | Write `backend/sql/module_pond_phase_7.sql` | Full migration: 5 Treatment INSERTs + 4 PondTreatment INSERTs, all idempotent. `BEGIN/COMMIT`. | file exists |
| 2 | [ ] | Apply to dev DB | `psql -f module_pond_phase_7.sql` on the live `aquaculture` DB. Expect `COMMIT` exit 0. | psql exit 0 |
| 3 | [ ] | Verify counts | `treatments` count = 6 (1 existing BioBloc + 5 new). `pond_treatments` count ≥ 4 (could be more if BioBloc rows existed). | psql `SELECT COUNT(*)` |
| 4 | [ ] | Idempotency | Re-run the migration. `COMMIT`, exit 0. Counts unchanged. | psql exit 0 + count |
| 5 | [ ] | Endpoint smoke | `GET /api/treatments/` returns 6 items. `GET /api/pond-treatments/?pond=<Pond A id>` returns at least 1 (water-change). | APIClient |
| 6 | [ ] | `manage.py check` | Exit 0. | check |

---

## Verification Block — after item 1

```bash
export PGPASSWORD='aquaculture'

# Apply
psql -h localhost -U postgres -d aquaculture -v ON_ERROR_STOP=1 \
    -f backend/sql/module_pond_phase_7.sql 2>&1 | tail -10

# Count check
psql -h localhost -U postgres -d aquaculture <<'SQL'
SELECT 'treatments' AS table_name, COUNT(*) FROM public.treatments
UNION ALL
SELECT 'pond_treatments', COUNT(*) FROM public.pond_treatments;
SQL

# Re-apply for idempotency
echo "=== second pass (idempotency) ==="
psql -h localhost -U postgres -d aquaculture -v ON_ERROR_STOP=1 \
    -f backend/sql/module_pond_phase_7.sql 2>&1 | tail -5

# Count again — should be identical
psql -h localhost -U postgres -d aquaculture -c "SELECT 'treatments', COUNT(*) FROM public.treatments UNION ALL SELECT 'pond_treatments', COUNT(*) FROM public.pond_treatments;"

# API smoke
cd backend && source venv/bin/activate
python manage.py shell <<'PY'
from rest_framework.test import APIClient
from module_user.models import User
from module_pond.models import Pond

user = User.objects.filter(is_active=True).first()
client = APIClient(); client.force_authenticate(user=user)
H = {'HTTP_HOST': 'localhost'}

r = client.get('/api/treatments/', **H)
print(f"GET /api/treatments/ → {r.status_code} count={len(r.json())}")

r = client.get('/api/pond-treatments/', **H)
print(f"GET /api/pond-treatments/ → {r.status_code} count={len(r.json())}")

pond_a = Pond.objects.filter(name='Pond A').first()
if pond_a:
    r = client.get(f'/api/pond-treatments/?pond={pond_a.pond_id}', **H)
    print(f"GET /api/pond-treatments/?pond=PondA → {r.status_code} count={len(r.json())}")
    if r.status_code == 200 and r.json():
        print(f"  sample row: {r.json()[0]}")
PY
```

Expected:
- First apply → `COMMIT`, exit 0.
- treatments count = 6.
- pond_treatments count = 4 (or more if pre-existing).
- Second apply → `COMMIT`, exit 0; counts unchanged.
- API: `/api/treatments/` count=6; `/api/pond-treatments/` count≥4; `?pond=PondA` returns the water-change entry.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| `Pond A` / `Fish Tank A` / `Crab Tank B` / `Pond C` don't exist by exact name | `INSERT ... SELECT FROM ponds WHERE name='...'` returns 0 rows; INSERT inserts 0. No error. Item 5's smoke catches it (count would be < 4). |
| `treatments_code_key` unique constraint conflicts on first apply | `ON CONFLICT (code) DO NOTHING` handles. |
| Two ponds happen to share a name across projects (e.g., 'Pond A' in shrimp + 'Pond A' in fish — unlikely but possible) | Current seed: every pond name is unique across all projects. If that changes, the seed picks "first match" — non-deterministic but still idempotent. Acceptable for demo data. |
| `CURRENT_DATE - INTERVAL '7 days'` interpretation in different Postgres locales | Works identically; INTERVAL is standard SQL. |
| Pond names could change in the seed file later | This migration assumes the specific names exist. Future renames break the linkage but won't break the script (just creates 0 rows). |

---

## Out of scope

| Item | Where |
|---|---|
| Diversifying `Pond.status` across the 16 demo ponds | Optional polish; left to user discretion (browser smoke) |
| Treatment catalogue with 20+ realistic types (e.g., aquaculture-specific) | Excessive for a demo seed; 6 covers the common cases |
| Historical PondTreatment chains (multiple treatments per pond over time) | Phase 8 deferred / future. The 4 sample rows show the pattern; admins can extend via the Pond inline. |
| Seeding `CycleDailyHealth` + `CycleStageMetric` | Already populated from earlier seeds (3278 + 60 rows). |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [ ] | `backend/sql/module_pond_phase_7.sql` exists |
| [ ] | Applied cleanly to dev DB: COMMIT, exit 0 |
| [ ] | `treatments` count = 6; `pond_treatments` count ≥ 4 |
| [ ] | Re-run is idempotent: counts unchanged |
| [ ] | `GET /api/treatments/` returns 6; `GET /api/pond-treatments/?pond=PondA` returns ≥1 |
| [ ] | `manage.py check` exits 0 |

---

## Files Touched in Phase 7

| File | What changed |
|---|---|
| `backend/sql/module_pond_phase_7.sql` (new) | 5 Treatment catalogue INSERTs + 4 sample PondTreatment INSERTs. Idempotent via `ON CONFLICT` / `NOT EXISTS`. |

Seed files (`aquashield_current_local_share.sql` etc.) untouched per the arc convention.

---

*Last updated: 2026-05-23*
