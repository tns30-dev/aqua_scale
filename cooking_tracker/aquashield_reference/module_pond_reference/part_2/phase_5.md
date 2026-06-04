# Part 2 — Phase 5 — Browser Smoke

---

## Goal

End-to-end manual verification that the Phase 1-4 work behaves correctly against a live BE + dev data. Catches what tsc can't: empty states, async race-conditions, visual collisions, regressions from the `status` → `healthStatus` rename.

---

## Prerequisites

| # | Setup | Command / Action |
|---|---|---|
| 1 | Django BE running | `cd backend && source venv/bin/activate && python manage.py runserver` |
| 2 | Vite FE running | `cd frontend && npm run dev` |
| 3 | Logged-in browser session | Open the dev URL (usually `http://localhost:5173`), log in normally |
| 4 | Django admin open in a second tab | `http://localhost:8000/admin/` (for seeding test data inline) |

### Test data prep (in Django admin)

To exercise every state, ensure the DB contains:

| Need | How to make |
|---|---|
| At least **one pond** in each non-active state | Module Pond → Ponds → pick 4 distinct ponds, set status to `draining`, `cleaning`, `maintenance`, `decommissioned` |
| **One pond with ≥1 active treatment** (`ended_at IS NULL`) | Pick a pond, add a Treatment row via the inline (started_at set, ended_at left blank) |
| **One pond with ≥1 past treatment** (both started_at + ended_at) | Same as above but set ended_at |
| **One pond with no treatments at all** | Just don't add any |
| At least one Treatment catalogue row | Module Pond → Treatments → add e.g. `code=ANTIBIOTIC_A`, `name=Antibiotic A`, `is_active=true` |

---

## Scenario 1 — Overview cards: sensor health (Phase 1 regression)

**Goal**: verify the `status` → `healthStatus` rename didn't break the existing healthy/warning/critical colouring.

| Step | Expected |
|---|---|
| 1. Open `/overview` | Pond cards render |
| 2. Wait for the first sensor reading to arrive (top-of-page "Live" pulse + "Last Updated" timestamp ticks) | Cards transition from gray (no_reading) to green / yellow / red based on actual parameters |
| 3. Cards with all-normal params | Green ring; no top-right badge; if **all** ponds in the project are healthy, the "Healthy — All parameters are within normal range" line shows under the heading |
| 4. Card with at least one warning parameter | Yellow ring; "Warning" badge at top-right |
| 5. Card with at least one critical parameter | Red ring; "Critical" badge at top-right |
| 6. A pond with no current reading | Gray ring; "No Readings" badge at top-right |
| 7. Hover any card | Tooltip shows key parameters with their current values + units |
| 8. Click any card | Navigates to `/digital-twin` with that pond selected |

**Fails if**: any card shows the wrong colour for its reading, or the "all healthy" header line fails to appear when every pond is green, or click-navigation no-ops.

---

## Scenario 2 — Overview cards: operational status badge (Phase 3)

**Goal**: verify the new badge appears only for non-active states, top-left, in the right colour.

| Step | Expected |
|---|---|
| 1. Open `/overview` after seeding 4 ponds with `draining` / `cleaning` / `maintenance` / `decommissioned` | The 4 ponds show a coloured chip at the **top-left** of their circle (mirrors the sensor-health badge at top-right) |
| 2. Verify chip colours per pond | `draining` → **blue**; `cleaning` → **cyan**; `maintenance` → **amber**; `decommissioned` → **gray** |
| 3. Verify chip labels | "Draining", "Cleaning", "Maintenance", "Decommissioned" (title case) |
| 4. A pond with status=`active` (default) | **No** top-left chip — only the sensor-health badge (if any) at top-right |
| 5. A pond where BE didn't return `status` (e.g. older row) | **No** top-left chip (same suppression as `active`) |
| 6. Toggle one pond from non-active back to `active` in admin, refresh `/overview` | Chip disappears |

**Fails if**: chip appears for `active` ponds, chip colour doesn't match the state, chip label is wrong, or chip overlaps the sensor-health badge at top-right.

---

## Scenario 3 — Digital Twin selector: operational status badge (Phase 3)

| Step | Expected |
|---|---|
| 1. Open `/digital-twin` from Overview by clicking a non-active pond's card | Page loads with that pond pre-selected |
| 2. Look immediately to the **right of the pond selector dropdown** | The same coloured chip from Scenario 2 appears inline |
| 3. Open the dropdown and pick an `active` pond | The chip vanishes |
| 4. Pick a `draining`/`cleaning`/`maintenance`/`decommissioned` pond | The chip reappears with the correct colour |
| 5. On a narrow viewport (e.g. mobile) | The wrap container lets the chip drop to a new line cleanly; no overlap with the live-update timestamp |

**Fails if**: chip doesn't update when the pond changes, or it visually collides with the "Live | Last Updated:" cluster.

---

## Scenario 4 — Digital Twin treatments timeline (Phase 4)

**Goal**: verify the treatments section fetches, renders, and reacts to pond switches.

| Step | Expected |
|---|---|
| 1. Open `/digital-twin` on a pond with one **active** treatment + at least one **past** treatment | "Treatments" section appears at the bottom of the right-side details panel |
| 2. While the fetch is in flight (slow network, throttle to "Slow 3G" in devtools if you want to see it) | "Loading treatments..." muted italic line |
| 3. After load — active treatment row | Treatment **name in bold**, small **green "Active"** chip, right-aligned **"Since DATE"** |
| 4. After load — past treatment row | Treatment name (not bold), right-aligned **"DATE → DATE"** date range |
| 5. Ordering | All active treatments first (newest started first), then all past (newest started first) |
| 6. Switch to a pond with **no treatments** via the selector | Section renders "No treatments recorded for this pond" (italic, muted) |
| 7. Switch back to the first pond | Treatments reappear (verify it actually re-fetched — old rows aren't sticky) |
| 8. Switch rapidly between two ponds (click → click → click within 1 second) | Final pond's treatments are correct; no flashes of the wrong pond's data |
| 9. Stop the Django server, then switch pond | "Couldn't load treatments" muted red line |
| 10. Restart Django, switch pond again | Recovers — section shows correct data |

**Fails if**: stale treatments from the previous pond leak through after a switch (cancelled-flag broken), or empty state doesn't show, or error state doesn't show.

---

## Scenario 5 — Cross-cutting regressions

Quick sanity checks for things the rename + new prop might have nudged:

| Step | Expected |
|---|---|
| 1. Profile switcher (top-right) — flip between profiles (shrimp / fish / crab) | Overview pond list filters correctly; Digital Twin pond list filters correctly; selected pond persists or resets per the existing behaviour |
| 2. On Digital Twin, collapse + re-expand the details panel toggle (the `‹` / `›` button on `xl:` screens) | Treatments section re-renders correctly after each expand; doesn't refetch needlessly on collapse |
| 3. Refresh the Overview page while a non-active pond is on screen | Operational badge survives the refresh (BE returns `status`) |
| 4. Pond Comparison page (`/pond-comparison`) | Unchanged — verify the pond selector dropdown still renders treatments by name (uses the older `PondTreatmentInfo` shape, not our new `PondTreatment`) |
| 5. Historical page | Unchanged — cycles + daily-health + chart still render |
| 6. Forecast page | `ForecastSummaryCards` still renders the harvest / disease-risk metrics correctly given the loosened `PondMetadata` |

**Fails if**: any pre-existing page regressed (especially Pond Comparison, since it touches treatments and has its own type).

---

## Scenario 6 — Console + network noise

Always do a quick pass:

| Step | Expected |
|---|---|
| 1. Devtools Console | No new React warnings, no "Cannot read property of undefined" runtime errors, no key warnings on the treatments list |
| 2. Devtools Network — switch to a pond | `GET /api/pond-treatments/?pond=<uuid>` fires exactly once per switch; 200 OK |
| 3. Devtools Network — initial Overview load | `GET /api/ponds?projectId=<uuid>` returns ponds with the `status` field present in the JSON |

**Fails if**: duplicate fetches per pond switch (would indicate effect re-runs unnecessarily), or `status` missing from `/api/ponds` response (means BE serializer isn't shipping it as expected).

---

## Sign-off block (fill in after smoking)

| Scenario | Pass / Fail / Notes |
|---|---|
| 1. Sensor health regression | |
| 2. Overview operational badge | |
| 3. Digital Twin operational badge | |
| 4. Treatments timeline | |
| 5. Cross-cutting regressions | |
| 6. Console + network | |

---

## What we are NOT smoking in this phase

| Item | Why |
|---|---|
| BE admin polish from Part-1 Phase 4b (custom widgets etc.) | Covered separately in Part-1 phase 9 |
| Treatment / PondTreatment CRUD | Lives in Django admin per overall.md — admin-side correctness is its own surface |
| Profile-aware metadata "proper reshape" | Deferred from Phase 4; today's Phase 1 minimal guards keep it functional |
| Cycle daily-health / cycle-stage-metrics endpoints | Deferred from Phase 2 (no FE consumer yet) |
| Cookie / CSRF / auth-refresh flow | Stable since User Mgmt Part 2; out of scope for module_pond smoke |

---

*Last updated: 2026-05-24*
