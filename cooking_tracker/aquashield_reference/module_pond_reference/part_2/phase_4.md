# Part 2 — Phase 4 — Pond Treatments Timeline

---

## Goal

Surface the per-pond treatment timeline on the Digital Twin page by adding a new "Treatments" section to `PondDetailsPanel`, fetched via `apiService.getPondTreatments(pondId)` (wired in Phase 2).

Out of scope (deferred): the `PondDetailsPanel` metadata-rendering "proper reshape" — the Phase 1 minimal `?? 'low'` / `?` guards already keep it functional. The full key-iteration redesign can land as a follow-up; today's behaviour is acceptable.

---

## Design

### Section placement

PondDetailsPanel currently has:
1. Company / GPS row + photo
2. Farm Metrics / Hatchery Metrics block (existing)

Treatments section goes **at the end** — below the metrics block. Visual treatment matches the metrics block (top border + section heading).

### What to render

The BE serializer returns each `PondTreatment` with denormalised `treatment_name`, `treatment_code`, `started_at`, `ended_at`, `is_active`. We render:

| State | Display |
|---|---|
| `is_active === true` (ended_at IS NULL) | bold name + `Active` chip (green) + "Started YYYY-MM-DD" |
| `is_active === false` (has ended_at)   | regular name + "YYYY-MM-DD → YYYY-MM-DD" date range |

Order: active first (sorted by `started_at` desc), then completed (sorted by `started_at` desc).

### Empty / loading / error states

| State | UI |
|---|---|
| `loading` (initial fetch or pond switch) | Single muted line "Loading treatments..." |
| `loaded && treatments.length === 0` | Muted line "No treatments recorded for this pond" |
| `error` | Muted red line "Couldn't load treatments" — no toast (panel is supplementary; toast would be noisy for a side panel) |

### Data flow

PondDetailsPanel gains a new optional `pondId?: string` prop. Inside, a `useEffect` keyed on `pondId` calls `apiService.getPondTreatments(pondId)` and stores the result in local state. A stale-request guard (`activePondId` ref) handles rapid pond switches.

`DigitalTwinPage` passes `pondId={selectedPond?.pond_id}` alongside the existing props.

---

## Component shape (sketch)

```tsx
// Inside PondDetailsPanel:
interface PondTreatmentRow { /* matches PondTreatment from types */ }

const [treatments, setTreatments] = useState<PondTreatment[]>([]);
const [tState, setTState] = useState<'idle' | 'loading' | 'error'>('idle');

useEffect(() => {
  if (!pondId) {
    setTreatments([]);
    setTState('idle');
    return;
  }
  let cancelled = false;
  setTState('loading');
  apiService.getPondTreatments(pondId)
    .then((rows) => { if (!cancelled) { setTreatments(rows); setTState('idle'); } })
    .catch(()    => { if (!cancelled) { setTState('error'); } });
  return () => { cancelled = true; };
}, [pondId]);

// In render:
const sorted = useMemo(() => {
  const activeRows = treatments.filter(t => t.is_active).sort((a, b) => b.started_at.localeCompare(a.started_at));
  const pastRows   = treatments.filter(t => !t.is_active).sort((a, b) => b.started_at.localeCompare(a.started_at));
  return [...activeRows, ...pastRows];
}, [treatments]);
```

(Final code will inline the rendering rather than extract sub-components — keeps it co-located and matches the panel's existing style.)

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | Add optional `pondId?: string` prop to `PondDetailsPanel` interface | New field in `PondDetailsPanelProps`. | grep |
| 2 | [x] | Fetch treatments inside `PondDetailsPanel` | useEffect keyed on `pondId`; cancelled-flag stale-request guard; useMemo sorts active-first then past. | grep |
| 3 | [x] | Render the Treatments section | Inside the same `Card`, after the metrics block (`border-t pt-4`). Handles loading / empty / error / loaded; active rows show bold name + green "Active" chip + "Since DATE"; past rows show "DATE → DATE". | grep |
| 4 | [x] | Wire `pondId` from `DigitalTwinPage` (both mobile + desktop usages) | Passed `pondId={selectedPond?.pond_id}` to both `<PondDetailsPanel />` call sites. | grep |
| 5 | [x] | Verification — tsc | tsc unique-files list identical to end-of-Phase-3 (HistoricalTrendsAnalysis_original, OnboardUserDialog, main.tsx, PondVisualization.test.tsx). PondDetailsPanel/DigitalTwinPage not in the list. | tsc |
| 6 | [ ] | Smoke (deferred to Phase 5) | Live visual check happens in Phase 5; treatments seed data created in Django admin by the user. | Phase 5 |

---

## Verification Block — after item 5

```bash
cd frontend
npx tsc --noEmit -p tsconfig.app.json 2>&1 | tee /tmp/tsc.out > /dev/null
grep -oE '^[^(]+' /tmp/tsc.out | sort -u
```

Expected: end-of-Phase-3 list unchanged.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| Rapid pond-switching causes treatments from the previous pond to land after the new one | `cancelled` flag in the effect cleanup — late responses are discarded. |
| `getPondTreatments` returns a 401 mid-session | The axios response interceptor already handles 401 via refresh-retry; transient failures surface to `setTState('error')` which renders the muted error line. No crash. |
| Pond from store has no treatments (BE returns `[]`) | Empty-state line. |
| Treatment shape from BE doesn't match the FE `PondTreatment` interface | The interface was declared in Phase 1 to match the BE serializer 1:1 (snake_case). Mismatch would surface at runtime as missing fields (rendered as `undefined`) — acceptable for a supplementary panel; better than crashing. |
| Many treatments accumulate over time (50+) | Acceptable — section will scroll within the panel naturally. If real-world data shows this becomes a problem, add a "show more" toggle in a follow-up. |

---

## Out of scope

| Item | Where |
|---|---|
| Metadata rendering "proper reshape" of `PondDetailsPanel` | Optional follow-up; Phase 1 guards already keep it functional |
| Treatment CRUD from FE | Per overall.md: CRUD lives in Django admin |
| Treatment timeline visual (Gantt-style) | Could be a future enhancement; today's list is sufficient |
| Browser smoke | Phase 5 |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `PondDetailsPanel` accepts `pondId?: string` and fetches treatments when it changes |
| [x] | Treatments section renders active + past treatments with sensible empty/loading/error states |
| [x] | `DigitalTwinPage` passes `pondId` to both render sites of `PondDetailsPanel` |
| [x] | tsc fallout list unchanged vs end-of-Phase-3 |

---

## Files Touched in Phase 4

| File | What changed |
|---|---|
| `frontend/src/components/digital-twin/PondDetailsPanel.tsx` | Added `pondId?` prop; added treatments fetch effect + state; added rendering of the Treatments section. |
| `frontend/src/pages/DigitalTwinPage.tsx` | Passed `pondId={selectedPond?.pond_id}` to both `<PondDetailsPanel />` call sites. |

---

*Last updated: 2026-05-24*
