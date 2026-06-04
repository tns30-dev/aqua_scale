# Module: Project Management — Review Checklist

Files to insightfully check for `module_project` (projects + the catalogue tables that
configure them: profile types, parameter types, growth indicators, project parameter
settings) across **backend** and **frontend**. Frontend mapped by tracing the API surface
(`/api/projects*`, `/api/profile-types`, `/api/parameter-types`, `/api/growth-indicators`)
and the project-selection / profile-theming / websocket plumbing.

Legend: 🔴 core · 🟡 supporting · 🟢 tests/fixtures · ⚪ shared / cross-module boundary

**Key architectural facts (read these first):**
- Projects are **read-only via the API** (`ReadOnlyModelViewSet`). All project CRUD happens
  in **Django admin** (`admin.py` + `forms.py` + widgets) — there is no project-create UI on
  the frontend.
- `module_pond` was **split out of** `module_project`. Pond + cycle + historical routes live
  in `module_pond.urls`. But `charts`, `summary`, `cycles`, and `pond-comparison` actions are
  mounted on `ProjectViewSet` and **delegate into** `module_pond` / `module_chart`.
- RBAC: `ProjectViewSet.get_queryset` filters by `RBACService.get_user_project_ids`; the
  websocket `ProjectConsumer` re-checks project access. Both must stay aligned with
  `module_user`. (Note: the `pond_comparison` **feature gate** here was just disabled — see
  `user_mgmt_reference/control_hide.md` §C.)

---

## BACKEND — `backend/module_project/`

### Core logic 🔴
- [ ] `module_project/models.py` — `ProfileType`, `Project`, `ParameterType`, `GrowthIndicator`,
  `ProjectParameterSetting`. Check FKs (profile_type, owner_user), constraints, db_table names,
  JSON/config fields, defaults.
- [ ] `module_project/views.py` — `ProjectViewSet` (read-only) + custom actions:
  `all` (admin-only full list), `charts`, `summary`, `cycles`, `pond_comparison_ponds`,
  `pond_comparison` (gate now commented). Plus catalogue viewsets `ProfileTypeViewSet`,
  `ParameterTypeViewSet`, `GrowthIndicatorViewSet`. Check RBAC scoping, permission_classes,
  response shapes, and the cross-module delegations.
- [ ] `module_project/serializers.py` — project + catalogue serializers. Check field exposure,
  snake↔camel naming, nested profile_type, read-only flags.
- [ ] `module_project/consumers.py` — `ProjectConsumer` (websocket): `connect`/`disconnect`,
  `alert_message`, `project_update`, `get_user_projects` (RBAC). Check group naming + auth.
- [ ] `module_project/urls.py` — DefaultRouter registrations (`projects`, `profile-types`,
  `parameter-types`, `growth-indicators`). Verify against frontend calls.

### Django admin 🟡 (this is the project CRUD surface)
- [ ] `module_project/admin.py` — Project/catalogue admin registrations.
- [ ] `module_project/forms.py` — admin forms (parameter settings, stage config, indicators).
- [ ] `module_project/templates/module_project/widgets/indicator_checkbox.html`
- [ ] `module_project/templates/module_project/widgets/stage_config_editor.html`

### Management commands 🟡
- [ ] `module_project/management/commands/seed_demo_data.py` — demo/seed data.
- [ ] `module_project/management/commands/reset_database.py` — DB reset helper.

### App config / wiring 🟡 (⚪ shared)
- [ ] `module_project/apps.py`
- [ ] `config/urls.py` — `path('api/', include('module_project.urls'))` (~line 25).
- [ ] `config/asgi.py` — `ProjectConsumer` websocket routing (~line 24).
- [ ] `config/settings/base.py` — app registration (~65), DB router map (~80).
- [ ] `module_project/migrations/0001_initial.py` — verify schema matches `models.py` (single
  migration — watch for drift, same pattern as module_user).

### Fixtures 🟢
- [ ] `module_project/fixtures/projects.json`
- [ ] `module_project/fixtures/cycle_daily_health.json`
- [ ] `module_project/fixtures/cycle_stage_metrics.json`

### Tests 🟢
- [ ] `module_project/tests.py` — single test module (unlike module_user's `tests/` package).
  Check coverage of RBAC scoping, the catalogue endpoints, and the cross-module actions.

---

## FRONTEND — `frontend/src/`

### Current-project selection & state 🔴
- [ ] `utils/auth.ts` — `getCurrentProjectId`/`setCurrentProjectId`,
  `getCurrentProfileType`/`setCurrentProfileType` (localStorage keys). The pivot the whole
  app reads to know "which project am I looking at."
- [ ] `components/layout/ProfileDropdown.tsx` — the **project switcher** (hidden when 0–1
  projects); on switch sets project id + profile type + re-themes.
- [ ] `components/layout/TopNavActions.tsx` — also reads current project id.
- [ ] `stores/pondStore.ts` ⚪ — holds `projects[]` for profile-based pond filtering
  (shared with module_pond). Check the profile-filter logic + the "sibling project leak" note.

### Profile-type config & theming (catalogue consumption) 🔴 / 🟡
- [ ] `context/ProfileContext.tsx` — profile-type config provider + `switchProfile`.
- [ ] `design-system/theme/ThemeProvider.tsx` — profile-type → theme mapping.
- [ ] `utils/profileColors.ts` — profile color mapping.
- [ ] `utils/schema.ts` ⚪ — profile/parameter schema helpers (also touches sensor/feature data).
- [ ] `types/profile.ts` — `ProfileConfig` and profile-type shapes (↔ `mapProfileTypeDTO`).

### API & types 🔴 / ⚪
- [ ] `services/api.service.ts` ⚪ — **project portion**: `getProfileTypes` + `mapProfileTypeDTO`,
  `getProjectSummary`, `getProjectCycles`, charts call, `pond-comparison` calls, `getAllProjects`
  (`/api/projects/all/`, admin-only), and the login post-step that seeds `currentProjectId`.
- [ ] `types/index.ts` ⚪ — `Project`, `ProjectSummary`, `CyclesResponse`, profile-type row types.

### WebSocket 🔴
- [ ] `services/websocket.service.ts` — `connectToProject`, `project_update` handling, reconnect.
- [ ] `hooks/useGlobalWebSocket.ts` — wires session projects → pondStore, opens the project WS
  using `getCurrentProjectId()`. Check the "skip projects from deps" reconnect note.

### Pages that consume the current project 🟡
- [ ] `pages/OverviewPage.tsx`
- [ ] `pages/ForecastPage.tsx`
- [ ] `pages/DigitalTwinPage.tsx`
- [ ] `pages/ABTestingPage.tsx`
- [ ] `pages/HistoricalDataPage.tsx` ⚪ (primarily module_chart/historical, but keyed by project)

### Tests & mocks 🟢
- [ ] `test/components/TopNav.test.tsx`
- [ ] `test/pages/LoginPage.test.tsx` (asserts `currentProjectId` seeding)
- [ ] `test/msw/handlers.ts` ⚪ — project/profile-type request mocks.
- [ ] `test/msw/data.ts` ⚪ — mock project/profile fixtures.
- [ ] `test/mocks.ts` ⚪ — shared project mocks.

---

## Cross-cutting things to verify (insight notes)
- [ ] **Read-only API vs admin CRUD**: confirm nothing on the frontend tries to POST/PUT a
  project; all mutations should be Django-admin only.
- [ ] **`/api/projects/` vs `/api/projects/all/`**: regular endpoint filters to the caller's
  `user_projects`; `all/` is platform-admin only. Verify the admin-only gate and that the UI
  uses each in the right place (assignment vs viewing).
- [ ] **Cross-module action boundaries**: `charts`/`summary`/`cycles`/`pond-comparison` live on
  `ProjectViewSet` but delegate into `module_pond`/`module_chart`. When reviewing, follow the
  delegation — bugs often hide at the seam.
- [ ] **RBAC parity**: `get_queryset` (HTTP) and `ProjectConsumer.get_user_projects` (WS) must
  scope identically. A mismatch = data visible on one channel but not the other.
- [ ] **profile_type contract**: `ProfileType.code` drives frontend theming, schema, and pond
  filtering. Verify `mapProfileTypeDTO` (snake→camel) matches the serializer output exactly.
- [ ] **Migration drift**: single `0001_initial.py` — confirm it reflects current `models.py`.