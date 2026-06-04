# Part 2 — Phase 3 — Operational Status Badge

---

## Goal

Surface the new operational `pond.status` (set by admin in Django) on the React UI:

1. **Overview** (`PondCircle`) — small chip near the pond card when the pond isn't in the default `'active'` state.
2. **Digital Twin** — chip next to the pond selector, same suppression rule.

Distinct visually from the sensor-health badge already at top-right of the pond circle (red/yellow/gray). The two badges must read as separate signals.

---

## Design decisions

### When to render

| Status | Render badge? |
|---|---|
| `active` | **No** — default operational state. Suppressing keeps the typical UI uncluttered. |
| `draining` / `cleaning` / `maintenance` / `decommissioned` | **Yes** |
| missing / undefined | **No** — treat the same as `active`. Until Part-2 Phase 2's API mapper backfills `status` defaults, freshly-fetched ponds might be missing the field; rendering nothing is correct. |

### Colour palette (kept far from healthStatus's red/yellow/green so the two signals don't collide)

| Status | Tailwind class | Reasoning |
|---|---|---|
| `draining`        | `bg-blue-500 text-white`   | "water moving out" → blue |
| `cleaning`        | `bg-cyan-500 text-white`   | sanitisation / fresh-water connotation |
| `maintenance`     | `bg-amber-500 text-white`  | caution / work-in-progress |
| `decommissioned`  | `bg-gray-600 text-white`   | inert / retired |

Labels are title-cased (`Draining`, `Cleaning`, …).

### Component shape

Single small reusable component:

```tsx
// frontend/src/components/overview/OperationalStatusBadge.tsx
import { clsx } from 'clsx';
import type { PondOperationalStatus } from '../../types';

interface Props {
  status?: PondOperationalStatus;
  className?: string;
}

const STYLE: Record<Exclude<PondOperationalStatus, 'active'>, string> = {
  draining: 'bg-blue-500 text-white',
  cleaning: 'bg-cyan-500 text-white',
  maintenance: 'bg-amber-500 text-white',
  decommissioned: 'bg-gray-600 text-white',
};

const LABEL: Record<Exclude<PondOperationalStatus, 'active'>, string> = {
  draining: 'Draining',
  cleaning: 'Cleaning',
  maintenance: 'Maintenance',
  decommissioned: 'Decommissioned',
};

export function OperationalStatusBadge({ status, className }: Props) {
  if (!status || status === 'active') return null;
  return (
    <span
      className={clsx(
        'inline-block px-2 py-0.5 rounded-full text-xs font-semibold',
        STYLE[status],
        className,
      )}
    >
      {LABEL[status]}
    </span>
  );
}
```

Lives under `components/overview/` because that's where `PondCircle` and `PondGrid` already live; will be imported into Digital Twin too.

### Placement on PondCircle

Top-left of the circle (mirroring the top-right sensor-health badge). Keeps both signals visible without overlap. Suppression of the `active` case means most cards still show only the sensor badge.

### Placement on Digital Twin

To the right of the pond selector dropdown — small inline chip. Suppressed for `active`. Doesn't disturb the layout because the chip is conditional and short.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | New `OperationalStatusBadge` component | Created `frontend/src/components/overview/OperationalStatusBadge.tsx` per § Component shape. | grep / open |
| 2 | [x] | Wire badge into `PondCircle` | Imported + rendered inside abs-positioned wrapper `-top-2 -left-2 z-10`. Empty-render path for `active`/undefined leaves the wrapper present but invisible (the inner span returns null). | grep |
| 3 | [x] | Wire badge into `DigitalTwinPage` | Imported + rendered inside the existing selector wrap (`flex items-center gap-3 flex-wrap`). `selectedPond?.status` flows in; component handles undefined/`active` with `null`. | grep |
| 4 | [x] | Verification — tsc | tsc unique-files list identical to end-of-Phase-2 (HistoricalTrendsAnalysis_original, OnboardUserDialog, main.tsx, PondVisualization.test.tsx). PondCircle/OperationalStatusBadge/DigitalTwinPage not in the list. | tsc |
| 5 | [ ] | Smoke (deferred to Phase 5) | Live visual check will run in Phase 5. | Phase 5 |

---

## Verification Block — after item 4

```bash
cd frontend
npx tsc --noEmit -p tsconfig.app.json 2>&1 | tee /tmp/tsc.out > /dev/null
grep -oE '^[^(]+' /tmp/tsc.out | sort -u
```

Expected: end-of-Phase-2 list unchanged.

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| `pond.status` is optional (Phase 1 decision); freshly-loaded ponds from current API might be missing it. | Badge returns `null` for both `undefined` and `'active'` — same visual outcome. No runtime error. |
| Top-left badge collides with top-right healthStatus badge on small viewports | Both badges are small chips with abs positioning at corners; they don't overlap. If the card itself is narrow at very small viewports we may want to revisit, but the current 32×32 card has room. |
| Adding a new visual signal may confuse users who only knew the sensor-health colour | Acceptable — the operational badge is conditional (only shown when status ≠ active) so the existing healthy-only flow is unchanged. |
| Digital Twin selector layout shifts when the chip appears | Acceptable; the wrap container is already `flex-wrap`, so worst case it drops to a new line on narrow screens. |

---

## Out of scope

| Item | Where |
|---|---|
| Treatments timeline UI | Phase 4 |
| Browser smoke | Phase 5 |
| Profile-aware metadata rendering | Phase 4 |
| Editing operational status from the FE | Not in this part — CRUD lives in Django admin per overall.md |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `OperationalStatusBadge` component exists and accepts `status?: PondOperationalStatus` |
| [x] | Badge renders on `PondCircle` (top-left, hidden when `active`/undefined) |
| [x] | Badge renders next to selector on `DigitalTwinPage` (hidden when `active`/undefined) |
| [x] | tsc fallout list unchanged vs end-of-Phase-2 |

---

## Files Touched in Phase 3

| File | What changed |
|---|---|
| `frontend/src/components/overview/OperationalStatusBadge.tsx` (new) | New chip component for the operational status. |
| `frontend/src/components/overview/PondCircle.tsx` | Imports + renders the badge at top-left of the circle. |
| `frontend/src/pages/DigitalTwinPage.tsx` | Imports + renders the badge inline next to the pond selector. |

---

*Last updated: 2026-05-24*
