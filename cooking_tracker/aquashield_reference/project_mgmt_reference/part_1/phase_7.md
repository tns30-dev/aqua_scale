# Part 1 — Phase 7 — Views + URLs

---

## Goal

Expose the three relocated/new reference catalogues over the REST API so Part 2 (frontend consolidation) can fetch them and finally retire `frontend/src/config/profiles/`.

Three new read-only endpoints:

| Endpoint | Method | Returns | Used by (Part 2) |
|---|---|---|---|
| `/api/profile-types/` | `GET` | All `ProfileType` rows incl. theme + stage_config + key indicators | `ProfileContext` on session load — drives the dropdown, gradient theme, page colours, parameter list. **The reason this whole arc exists.** |
| `/api/parameter-types/` | `GET` | All `ParameterType` rows (code, display name, unit, data_type) | FE label/unit lookup for chart axes + threshold tooltips |
| `/api/growth-indicators/` | `GET` | All `GrowthIndicator` rows (code, name, unit, data_type) | FE label/unit lookup for growth-metric displays |

All three are **read-only, authenticated, no pagination** (small datasets — 4 / 22 / 11 rows). Admin CRUD already exists on `/admin/` from Phase 6.

---

## Why this shape

### Three separate viewsets vs one combined endpoint

Considered a single `/api/reference-data/` returning `{profileTypes: [...], parameterTypes: [...], growthIndicators: [...]}`. Rejected because:

- Three separate endpoints match the natural cache boundaries — ProfileType changes infrequently, ParameterType changes essentially never, GrowthIndicator changes when a profile is added.
- The FE can lazy-load only what each page needs.
- Matches DRF convention + existing `ProjectViewSet` pattern in this module.

### `ReadOnlyModelViewSet` vs `ListAPIView`

Went with **`ReadOnlyModelViewSet`** to match the existing `ProjectViewSet` style (`views.py:27`). Gives both list + detail endpoints; the detail route is harmless free surface that FE may or may not use later. Single style across the module is worth more than minimising surface here.

### Permissions: `IsAuthenticated`

Matches `ProjectViewSet`. These are catalogue lookups — any authenticated user with any project assignment needs them. No platform-admin gate.

### No pagination

Set `pagination_class = None` explicitly on each viewset:

- 4 profile types → pagination is overhead.
- 22 parameter types → fits in one page anyway.
- 11 growth indicators → same.

The FE prefers a flat array — explicit `pagination_class = None` guarantees it regardless of any global `DEFAULT_PAGINATION_CLASS` setting.

---

## Final Target for This Phase

```text
module_project/views.py (after Phase 7)
  ProjectViewSet                ← unchanged (existing)
  ProfileTypeViewSet            ← NEW (ReadOnlyModelViewSet)
  ParameterTypeViewSet          ← NEW
  GrowthIndicatorViewSet        ← NEW

module_project/urls.py (after Phase 7)
  router.register('projects',          ProjectViewSet,         basename='project')
  router.register('profile-types',     ProfileTypeViewSet,     basename='profile-type')
  router.register('parameter-types',   ParameterTypeViewSet,   basename='parameter-type')
  router.register('growth-indicators', GrowthIndicatorViewSet, basename='growth-indicator')
```

No model changes. No SQL changes. No admin changes.

---

## Response Shapes (for Part 2's reference)

These come straight from the Phase 2/5 serializers — no shape work here.

### `GET /api/profile-types/`

```jsonc
[
  {
    "profile_type_id": "uuid",
    "code": "shrimp",
    "name": "Shrimp Farm",
    "description": "...",
    "stage_config": [
      {"name": "Stocking", "startDay": 1, "endDay": 7},
      ...
    ],
    "key_parameter_indicators": ["temperature", "ph", "dissolved_oxygen"],
    "key_growth_indicators": ["body_weight", "fcr"],
    "theme": {
      "primary": "#888888",
      "gradient": {"from": "#888888", "to": "#cccccc"}
    }
  },
  ...
]
```

> **Note:** Phase 8 will overwrite the placeholder `#888888` theme values with the real per-profile colours imported from `frontend/src/config/profiles/`. The shape stays the same.

### `GET /api/parameter-types/`

```jsonc
[
  {
    "parameter_id": "uuid",
    "parameter_code": "temperature",
    "parameter_name": "temperature",
    "unit": "°C",
    "data_type": "float"
  },
  ...
]
```

### `GET /api/growth-indicators/`

```jsonc
[
  {
    "growth_indicator_id": "uuid",
    "code": "body_weight",
    "name": "Mean Body Weight",
    "unit": "g",
    "data_type": "float"
  },
  ...
]
```

---

## Checklist Tracking

| No. | Done | Area | Step | Expected Result | Verification |
|---|---|---|---|---|---|
| 1 | [x] | `module_project/views.py` — imports | Extend the existing `from .models import Project` to also import `ProfileType, ParameterType, GrowthIndicator`. Extend the existing `from .serializers import ProjectSerializer, ProjectDetailSerializer` to also import `ProfileTypeSerializer, ParameterTypeSerializer, GrowthIndicatorSerializer`. | Imports clean | grep |
| 2 | [x] | `module_project/views.py` — `ProfileTypeViewSet` | Add `class ProfileTypeViewSet(viewsets.ReadOnlyModelViewSet)`. `queryset = ProfileType.objects.all().order_by('code')`, `serializer_class = ProfileTypeSerializer`, `permission_classes = [IsAuthenticated]`, `pagination_class = None`. | ViewSet class importable | manage.py check ✅ |
| 3 | [x] | `module_project/views.py` — `ParameterTypeViewSet` | Same shape. `queryset = ParameterType.objects.all().order_by('parameter_code')`, `serializer_class = ParameterTypeSerializer`, `permission_classes = [IsAuthenticated]`, `pagination_class = None`. | ViewSet class importable | manage.py check ✅ |
| 4 | [x] | `module_project/views.py` — `GrowthIndicatorViewSet` | Same shape. `queryset = GrowthIndicator.objects.all().order_by('code')`, `serializer_class = GrowthIndicatorSerializer`, `permission_classes = [IsAuthenticated]`, `pagination_class = None`. | ViewSet class importable | manage.py check ✅ |
| 5 | [x] | `module_project/urls.py` — imports | Extend `from .views import ProjectViewSet` to include the 3 new viewsets. | Imports clean | grep |
| 6 | [x] | `module_project/urls.py` — router registrations | Add `router.register('profile-types', ProfileTypeViewSet, basename='profile-type')`, `router.register('parameter-types', ParameterTypeViewSet, basename='parameter-type')`, `router.register('growth-indicators', GrowthIndicatorViewSet, basename='growth-indicator')`. | Routes registered | URL resolves ✅ |
| 7 | [x] | Verification — `manage.py check` | Exit 0 | Django config valid | `python manage.py check` — only pre-existing staticfiles.W004 warning |
| 8 | [x] | Verification — URL resolution | Shell smoke: `reverse('module_project:profile-type-list')` resolves to `/api/profile-types/`; same for the other two. | URLs resolve | shell smoke: all 3 paths printed correctly |
| 9 | [x] | Verification — endpoint smoke (auth) | Shell smoke using `rest_framework.test.APIClient`: log a real user in, GET each of the 3 endpoints, confirm 200 + expected row counts (4 / 22 / 11) + expected key set in the first row. | All three return live data | shell smoke: status=200, counts=4/22/11 (exact), responses are flat lists (no pagination wrapper), first-row keys match serializer field lists |
| 10 | [x] | Verification — endpoint smoke (anon) | Same `APIClient`, no auth: GET `/api/profile-types/` returns 401/403 (proving `IsAuthenticated` is enforced). | Anonymous request rejected | shell smoke: status=401 |

---

## Verification Block — to run after item 7

```bash
# 1. Django config check
python manage.py check
# expect: exit 0 (only pre-existing staticfiles.W004 warning)

# 2. URL resolution + endpoint smoke + auth gate
python manage.py shell <<'PY'
from django.urls import reverse
from rest_framework.test import APIClient
from module_user.models import User

# --- 1. URL resolution ---
print("--- URL resolution ---")
print(reverse('module_project:profile-type-list'))
print(reverse('module_project:parameter-type-list'))
print(reverse('module_project:growth-indicator-list'))
print()

# --- 2. Anonymous gate ---
print("--- Anonymous request (expect 401/403) ---")
anon = APIClient()
r = anon.get('/api/profile-types/')
print(f"anon GET /api/profile-types/ → {r.status_code}")
print()

# --- 3. Authenticated smoke ---
print("--- Authenticated request ---")
user = User.objects.filter(is_active=True).first()
print(f"Acting as: {user.email}")
client = APIClient()
client.force_authenticate(user=user)

for url, name, expected_count_hint in [
    ('/api/profile-types/',     'profile-types',     4),
    ('/api/parameter-types/',   'parameter-types',   22),
    ('/api/growth-indicators/', 'growth-indicators', 11),
]:
    r = client.get(url)
    body = r.json()
    count = len(body) if isinstance(body, list) else body.get('count', '?')
    sample_keys = sorted(body[0].keys()) if isinstance(body, list) and body else '(empty)'
    print(f"  {name}: status={r.status_code} count={count} (expected ~{expected_count_hint})")
    print(f"    first row keys: {sample_keys}")
PY
```

Expected:
- URL resolution prints the three `/api/...` paths.
- Anonymous GET → 401 or 403.
- Authenticated GET → 200 on all three; counts roughly 4 / 22 / 11; first-row keys match the serializer field lists.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| Existing global pagination config might wrap responses in `{count, next, previous, results}` | `pagination_class = None` on each viewset explicitly opts out. Verified by the smoke (checks `isinstance(body, list)`). |
| Adding the routes under namespace `module_project` could collide with existing `project-...` route names | basenames are `profile-type`, `parameter-type`, `growth-indicator` — distinct from `project`. DRF generates `<basename>-list` / `<basename>-detail`, so `profile-type-list` etc. — no collision. |
| Some users may have no `user_projects` assignments and still hit these endpoints | Intentional — these are catalogue endpoints. Any authenticated user gets them. `RBACService.get_user_project_ids` filter does NOT apply here. |
| Schema drift if Phase 8 changes the theme shape | Phase 8 only fills values, doesn't change shape. Serializer field list is locked in Phase 2/5. |

---

## Out of Scope for Phase 7

| Phase | Work |
|---|---|
| Phase 8 | Seed real per-profile theme JSONB values + populate `is_key_parameter` flags. |
| Phase 9 | Manual smoke across the whole arc. |
| Phase 10 | Docs. |
| Part 2 | Frontend consumes these endpoints — `ProfileContext` refactor + `frontend/src/config/profiles/` deletion. |

**Not in this phase:** writeable endpoints (admin handles CRUD), filtering / search query params (not needed for small catalogues), authentication changes, schema changes.

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `module_project/views.py` exports `ProfileTypeViewSet`, `ParameterTypeViewSet`, `GrowthIndicatorViewSet` |
| [x] | `module_project/urls.py` registers the 3 new routes |
| [x] | `manage.py check` exits 0 |
| [x] | Shell smoke: URLs resolve, anonymous → 401, authenticated → 200 with exact row counts 4/22/11 on all three endpoints |
| [x] | First-row key sets on each response match the serializer field lists |

---

## Files Touched in Phase 7

To be filled in as items are checked off.

| File | What changed |
|---|---|
| `backend/module_project/views.py` | Added `ProfileTypeViewSet`, `ParameterTypeViewSet`, `GrowthIndicatorViewSet` (all `ReadOnlyModelViewSet`, `IsAuthenticated`, `pagination_class=None`). Extended model + serializer imports. |
| `backend/module_project/urls.py` | Registered 3 new routes on the existing router. Extended view imports. |

---

*Last updated: 2026-05-22*
