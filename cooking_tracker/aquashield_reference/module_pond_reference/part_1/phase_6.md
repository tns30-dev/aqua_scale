# Part 1 — Phase 6 — Views + URLs

---

## Goal

Surface the 4 new/extended serializers from Phase 5 as read-only REST endpoints so the FE (Part 2) can consume them. Mutations stay in Django admin per the convention from project-mgmt (no React-side CRUD).

After Phase 6:
- `GET /api/treatments/` — catalogue list.
- `GET /api/pond-treatments/?pond=<uuid>` — treatments for a specific pond (or all, if no filter).
- `GET /api/cycle-daily-health/?cycle=<uuid>` — daily health rows for a cycle.
- `GET /api/cycle-stage-metrics/?cycle=<uuid>` — stage metric rows for a cycle.

Existing `PondViewSet` + `CycleViewSet` already cover `/api/ponds/` and `/api/cycles/`. The new fields they surface (Phase 5) ride through automatically — no view changes required there.

---

## Design

### Pattern (matches project-mgmt + existing module_pond views)

```python
class XViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = XSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        # RBAC scope where applicable + ?param= filter
        ...
```

All 4 new viewsets follow this shape. Same as `ProfileTypeViewSet` / `ParameterTypeViewSet` from project-mgmt Phase 7.

### URL conventions

Kebab-case in URLs:
- `/api/treatments/` (single word — no change)
- `/api/pond-treatments/` (kebab — matches `/api/profile-types/`, `/api/growth-indicators/` from project-mgmt)
- `/api/cycle-daily-health/` (kebab)
- `/api/cycle-stage-metrics/` (kebab)

Basenames in DRF DefaultRouter follow the kebab form so URL reverse-lookups are predictable (`'pond-treatment-list'`, etc.).

### RBAC scoping per viewset

| Endpoint | Scoping |
|---|---|
| `/api/treatments/` | None — pure catalogue, any authenticated user. |
| `/api/pond-treatments/` | RBAC via `pond.project` ∈ user's projects. `?pond=<uuid>` further narrows. |
| `/api/cycle-daily-health/` | RBAC via `cycle.pond.project`. `?cycle=<uuid>` further narrows. |
| `/api/cycle-stage-metrics/` | RBAC via `cycle.pond.project`. `?cycle=<uuid>` further narrows. |

Reuses `RBACService.get_user_project_ids(request.user)` (same helper used by `PondViewSet`).

### Why standalone + filter, not nested `@action`

Considered nesting (e.g., `/api/ponds/<id>/treatments/` via `@action(detail=True)` on `PondViewSet`). Rejected:

- Filter-based endpoints compose better: `/api/pond-treatments/?pond=X` + `/api/pond-treatments/?treatment=Y` use the same handler.
- The FE already follows this convention (`?projectId=` on ponds endpoint).
- Less route surface to register and document.

If a nested endpoint is later needed for ergonomic reasons, it can be added as a thin `@action` aliasing the standalone view.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | `views.py` — imports | Models + serializers imports extended. | done |
| 2 | [x] | `views.py` — `TreatmentViewSet` | New `ReadOnlyModelViewSet`, ordered by `name`. | done |
| 3 | [x] | `views.py` — `PondTreatmentViewSet` | RBAC by `pond__project_id__in` + `?pond=` filter; ordered by `-started_at`. | done |
| 4 | [x] | `views.py` — `CycleDailyHealthViewSet` | RBAC by `cycle__pond__project_id__in` + `?cycle=` filter; ordered by `cycle, day_number`. | done |
| 5 | [x] | `views.py` — `CycleStageMetricViewSet` | Same pattern as DailyHealth; ordered by `cycle, stage_name`. | done |
| 6 | [x] | `urls.py` — register routes | 4 new `router.register` calls with kebab-case paths (`treatments`, `pond-treatments`, `cycle-daily-health`, `cycle-stage-metrics`) + singular basenames. | done |
| 7 | [x] | Verification — `manage.py check` | Exit 0. | ✅ |
| 8 | [x] | Verification — URL resolution | `reverse('module_pond:treatment-list')` etc. → expected `/api/...` paths exactly. | ✅ |
| 9 | [x] | Verification — endpoint smoke (authenticated) | All 4 endpoints → 200, flat list. `treatments` count=1 (BioBloc), `pond-treatments` count=0, `cycle-daily-health` count=3278, `cycle-stage-metrics` count=60. Filter spot-check: `?cycle=<uuid>` narrowed daily_health 3278 → 89, stage_metrics 60 → 4. | ✅ |
| 10 | [x] | Verification — auth gate | Anonymous GET on all 4 endpoints → 401. | ✅ |

---

## Verification Block — after item 6

```bash
cd backend && source venv/bin/activate
python manage.py check

python manage.py shell <<'PY'
from django.urls import reverse
from rest_framework.test import APIClient
from module_user.models import User
from module_pond.models import Pond, Cycle, PondTreatment

# 1. URL resolution
print("--- URLs ---")
for name in ('treatment-list', 'pond-treatment-list', 'cycle-daily-health-list', 'cycle-stage-metric-list'):
    print(f"  {name:30s} → {reverse(f'module_pond:{name}')}")

# 2. Authenticated smoke
user = User.objects.filter(is_active=True).first()
print(f"\nActing as: {user.email}")
client = APIClient(); client.force_authenticate(user=user)
H = {'HTTP_HOST': 'localhost'}

for path in (
    '/api/treatments/',
    '/api/pond-treatments/',
    '/api/cycle-daily-health/',
    '/api/cycle-stage-metrics/',
):
    r = client.get(path, **H)
    body = r.json() if r.status_code == 200 else None
    count = len(body) if isinstance(body, list) else (body.get('count', '?') if isinstance(body, dict) else '?')
    print(f"  GET {path:35s} → {r.status_code}  count={count}")

# 3. Filter param spot-check
print("\n--- Filter param spot-check ---")
pond = Pond.objects.first()
r = client.get(f'/api/pond-treatments/?pond={pond.pond_id}', **H)
print(f"  ?pond={pond.pond_id}  → status={r.status_code}  count={len(r.json()) if r.status_code==200 else '?'}")

cycle = Cycle.objects.first()
r = client.get(f'/api/cycle-daily-health/?cycle={cycle.cycle_id}', **H)
print(f"  ?cycle={cycle.cycle_id} → status={r.status_code}  count={len(r.json()) if r.status_code==200 else '?'}")

# 4. Anonymous gate
print("\n--- Anonymous gate ---")
anon = APIClient()
for path in (
    '/api/treatments/',
    '/api/pond-treatments/',
    '/api/cycle-daily-health/',
    '/api/cycle-stage-metrics/',
):
    r = anon.get(path, **H)
    print(f"  anon GET {path:35s} → {r.status_code}")
PY
```

Expected:
- All 4 reverse-names resolve to the kebab-case `/api/...` paths.
- Authenticated GET returns 200 with a flat list (no pagination wrapper).
- Filter params narrow the list.
- Anonymous → 401 on every new endpoint.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| RBAC chain `cycle__pond__project_id__in=user_project_ids` makes the query 3 joins deep — could be slow at scale | Tables small (≤41 rows). Acceptable. select_related where helpful. |
| The `cycle-daily-health` and `cycle-stage-metric` data is per-day / per-stage — could return hundreds of rows | Acceptable for the demo dataset. If we hit pagination need later, set `pagination_class = StandardPageNumberPagination` per endpoint. |
| Treatment catalogue grows over time | Pagination still off by default. 22+ rows is fine. |
| `treatment_id` filter on `pond-treatments` (not yet exposed) — admin might want it | Out of scope. Add when a consumer asks. |
| `is_active=true` filter on Treatment catalogue (hide retired entries) | Out of scope. The Treatment.is_active flag is exposed; FE can filter client-side. |

---

## Out of scope

| Item | Where |
|---|---|
| Seeding Treatment + PondTreatment rows | Phase 7 |
| Nested `@action` aliases like `/api/ponds/<id>/treatments/` | Possible future polish; not needed if standalone+filter works |
| Pagination | Defer until row count justifies it |
| Search/filter on Treatment.name | Defer; admin handles search |
| Write endpoints (POST/PUT/DELETE) | Out of scope per project convention (admin owns mutations) |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | 4 new `ReadOnlyModelViewSet` classes in `views.py` |
| [x] | 4 new router registrations in `urls.py` with kebab-case paths |
| [x] | `manage.py check` exits 0 |
| [x] | Shell smoke: URL resolves + 200 + flat list + RBAC + filter narrowing + 401 on anonymous |

---

## Files Touched in Phase 6

| File | What changed |
|---|---|
| `backend/module_pond/views.py` | Extended imports. Added `TreatmentViewSet`, `PondTreatmentViewSet`, `CycleDailyHealthViewSet`, `CycleStageMetricViewSet` — all `ReadOnlyModelViewSet` with `IsAuthenticated` + `pagination_class=None` + RBAC scoping + `?pond=` / `?cycle=` filters where applicable. |
| `backend/module_pond/urls.py` | Registered 4 new routes (`treatments`, `pond-treatments`, `cycle-daily-health`, `cycle-stage-metrics`). |

---

*Last updated: 2026-05-23*
