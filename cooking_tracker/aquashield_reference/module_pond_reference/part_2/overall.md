# Part 2 — Frontend Integration

> Surface the new BE work from Part 1 on the React side. FE stays read-only; admins continue using Django admin for CRUD (per the convention from project-mgmt Part 2).

---

## Why this part

Part 1 added new BE surface that the React app doesn't yet consume:

- `Pond.status` — operational state (active/draining/cleaning/maintenance/decommissioned)
- `Pond.metadata` — freeform JSONB, shape varies by profile (shrimp/fish vs crab)
- `Treatment` catalogue + `PondTreatment` per-pond timeline
- 4 new endpoints: `/api/treatments/`, `/api/pond-treatments/?pond=<id>`, `/api/cycle-daily-health/?cycle=<id>`, `/api/cycle-stage-metrics/?cycle=<id>`

Part 2 wires these into the FE so users can see them.

---

## Current FE audit

| File | What it does today | Touch in Part 2? |
|---|---|---|
| `types/index.ts` — `Pond` interface | Has `status: 'healthy'\|'warning'\|'critical'\|'no_reading'` — derived from **sensor readings**, not the new BE operational status | **Phase 1** — naming collision; rename or split |
| `types/index.ts` — `PondMetadata` interface | Only models the shrimp/fish shape (6 fields). Crab pond fields (`larvae_count`, `target_species`, …) untyped | **Phase 1** — loosen to support both shapes |
| `services/api.service.ts` | Has `getPonds`, `getHistoricalData`, `getPondComparison*` — no methods for treatments / stage-metrics / daily-health | **Phase 2** — add 3-4 read methods + snake→camel mapper |
| `components/digital-twin/PondDetailsPanel.tsx` | Renders `pond.metadata` fields (company, GPS, biomass, etc.) — hardcoded against the shrimp/fish shape | **Phase 4** — handle both shapes; show whichever keys are present |
| `components/forecast/ForecastSummaryCards.tsx` | Same metadata consumption | **Phase 4** — same loosening |
| `components/overview/PondCircle.tsx` (likely) | Renders pond cards on Overview | **Phase 3** — add operational status badge |
| `pages/DigitalTwinPage.tsx` | Currently shows metadata + sensor data | **Phase 4** — possibly add treatments timeline section |

---

## Naming collision — `Pond.status`

- **FE today**: `status: 'healthy' | 'warning' | 'critical' | 'no_reading'` (sensor-derived UI label)
- **BE Part 1**: `status: 'active' | 'draining' | 'cleaning' | 'maintenance' | 'decommissioned'` (operational state)

These are conceptually different fields. Need to resolve. Two options:

**Option A — Rename FE field**: FE `status` becomes `healthStatus` (or `sensorStatus`). Then BE `status` flows through cleanly as the new operational field.

**Option B — Add separate field on FE**: Keep FE `status` as-is for sensor health. Add new `operationalStatus` (camelCase from `status`). Both fields coexist on the same Pond row.

Option A is cleaner (matches BE field naming) but requires touching every place the FE reads `pond.status`. Option B is additive but ambiguous (two fields named similarly).

**Recommendation: A** — rename FE `status` → `healthStatus` so the term `status` aligns with BE convention and the operational meaning. The rename's blast radius is bounded (Overview pond cards + maybe one or two more spots).

---

## Out of scope

| Item | Why |
|---|---|
| FE CRUD for treatments / metadata | Per overall.md — CRUD lives in Django admin |
| Profile-aware metadata rendering | Display whatever keys are present; let users see the raw shape per pond |
| Cycle daily health visualisation | Already covered by the existing `/api/cycles/{id}/details/` camelCase endpoint consumed by Historical page |
| Stage metrics dedicated display | Same — already used by chart pipeline |

---

## Sketched Phases

| # | Title | Goal |
|---|---|---|
| 1 | Types reshape | Rename FE `Pond.status` → `healthStatus`; add `operationalStatus`; loosen `PondMetadata` to be tolerant of both shapes; add `Treatment` + `PondTreatment` types |
| 2 | API client methods | `getTreatments()`, `getPondTreatments(pondId)`, optionally `getCycleDailyHealth(cycleId)` + `getCycleStageMetrics(cycleId)`. Snake→camel mapper at each method boundary (per D4) |
| 3 | Pond operational status badge | Render the new operational `status` on Overview pond cards + Digital Twin header. Distinct visual from the sensor health indicator |
| 4 | Pond treatments timeline | New section in `PondDetailsPanel` (Digital Twin) showing active + completed treatments for the pond, fetched via `getPondTreatments(pondId)` |
| 5 | Browser smoke | Verify each new piece renders against the live BE + dev data |

---

## Engineering rules (carry-over)

- One checklist item per edit. Track in phase doc immediately.
- `phase_N.md` written BEFORE executing the phase.
- `tsc --noEmit -p tsconfig.app.json` clean per phase.
- Manual smoke is acceptance — no FE unit tests in scope (matching the convention from project-mgmt Part 2).
- Two-repo flow: implement on learning, smoke, port to prod on user signal, commit on learning.

---

## Phase status

```text
Part 2 (Frontend integration)
  Phase 1 (Types reshape)             DONE  -> part_2/phase_1.md
  Phase 2 (API client methods)        DONE  -> part_2/phase_2.md
  Phase 3 (Operational status badge)  DONE  -> part_2/phase_3.md
  Phase 4 (Treatments timeline)       DONE  -> part_2/phase_4.md
  Phase 5 (Browser smoke)             TODO  (next)
```

---

*Last updated: 2026-05-23*
