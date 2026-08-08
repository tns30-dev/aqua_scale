import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CycleCandidateCard } from "./CycleCandidateCard";
import { fmtRange } from "./format";
import type { FeedingCycleOption, FeedingPondOption } from "./types";

/**
 * The comparison configuration (consultant redesign 27 Jul 2026): two
 * independent side pickers — slot "Pond A" and slot "Pond B", like the Pond
 * Comparison page — with no tie to the dashboard selection above. Applying
 * SWAPS the configuration away for the full-width VS strip; the ✕ on the
 * strip swaps the configuration back (it does not clear — Clear lives in
 * the configuration footer).
 */

interface Pair {
  baseId: string;
  cmpId: string;
}

interface ComparePanelProps {
  ponds: FeedingPondOption[];
  colorA: string;
  colorB: string;
  applied: Pair | null;
  onApply: (baseId: string, cmpId: string) => void;
  onClear: () => void;
}

const ownerOf = (ponds: FeedingPondOption[], cycleId: string | null) =>
  cycleId ? ponds.find((p) => p.cycles.some((c) => c.cycleId === cycleId)) : undefined;

const cycleName = (pond: FeedingPondOption | undefined, cycleId: string) => {
  const i = pond ? pond.cycles.findIndex((c) => c.cycleId === cycleId) : -1;
  return i >= 0 ? `${pond!.name} · Cycle ${i + 1}` : "";
};

const cycleOf = (pond: FeedingPondOption | undefined, cycleId: string): FeedingCycleOption | undefined =>
  pond?.cycles.find((c) => c.cycleId === cycleId);

interface SideProps {
  label: string;
  color: string;
  active: boolean;
  ponds: FeedingPondOption[];
  pondId: string | null;
  cycleId: string | null;
  onPond: (pid: string) => void;
  onCycle: (cid: string) => void;
}

function SideBlock({ label, color, active, ponds, pondId, cycleId, onPond, onCycle }: SideProps) {
  const pond = ponds.find((p) => p.pondId === pondId);
  const cycles = pond ? pond.cycles.slice().reverse() : [];
  return (
    <div
      className="space-y-2.5 rounded-xl border-2 bg-white p-3"
      style={{ borderColor: active ? color : "#e5e7eb" }}
    >
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
      </div>
      <select
        value={pondId ?? ""}
        onChange={(e) => onPond(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
      >
        <option value="" disabled>Choose a pond</option>
        {ponds.map((p) => (
          <option key={p.pondId} value={p.pondId}>{p.name}</option>
        ))}
      </select>
      {pond && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {cycles.length ? (
            cycles.map((c) => {
              const n = pond.cycles.findIndex((x) => x.cycleId === c.cycleId) + 1;
              return (
                <CycleCandidateCard
                  key={c.cycleId}
                  cycle={c}
                  name={`Cycle ${n}`}
                  selected={cycleId === c.cycleId}
                  onClick={() => onCycle(c.cycleId)}
                />
              );
            })
          ) : (
            <p className="text-xs text-gray-500">This pond has no cycles yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ComparePanel({ ponds, colorA, colorB, applied, onApply, onClear }: ComparePanelProps) {
  const [leftPond, setLeftPond] = useState<string | null>(null);
  const [leftCycle, setLeftCycle] = useState<string | null>(null);
  const [rightPond, setRightPond] = useState<string | null>(null);
  const [rightCycle, setRightCycle] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(true);

  useEffect(() => {
    setConfigOpen(applied == null);
    if (!applied) return;
    const baseOwner = ownerOf(ponds, applied.baseId);
    const cmpOwner = ownerOf(ponds, applied.cmpId);
    if (baseOwner) {
      setLeftPond(baseOwner.pondId);
      setLeftCycle(applied.baseId);
    }
    if (cmpOwner) {
      setRightPond(cmpOwner.pondId);
      setRightCycle(applied.cmpId);
    }
  }, [applied, ponds]);

  const sameCycle = leftCycle != null && leftCycle === rightCycle;
  const ready = leftCycle != null && rightCycle != null && !sameCycle;
  const isApplied = applied != null && applied.baseId === leftCycle && applied.cmpId === rightCycle;

  const leftOwner = ownerOf(ponds, applied?.baseId ?? null);
  const rightOwner = ownerOf(ponds, applied?.cmpId ?? null);
  const leftInfo = applied ? cycleOf(leftOwner, applied.baseId) : undefined;
  const rightInfo = applied ? cycleOf(rightOwner, applied.cmpId) : undefined;

  if (applied && !configOpen && leftInfo && rightInfo) {
    return (
      <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="border-l-4 pl-3" style={{ borderColor: colorA }}>
          <p className="text-[15px] font-extrabold tracking-tight text-gray-900">{cycleName(leftOwner, applied.baseId)}</p>
          <p className="text-[11px] font-medium text-gray-500">{fmtRange(leftInfo.startDate, leftInfo.endDate)}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 font-mono text-[11px] font-black uppercase text-white shadow">vs</span>
        <div className="border-r-4 pr-3 text-right" style={{ borderColor: colorB }}>
          <p className="text-[15px] font-extrabold tracking-tight text-gray-900">{cycleName(rightOwner, applied.cmpId)}</p>
          <p className="text-[11px] font-medium text-gray-500">{fmtRange(rightInfo.startDate, rightInfo.endDate)}</p>
        </div>
        <button
          type="button"
          onClick={() => setConfigOpen(true)}
          title="Change the comparison"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">Pick a pond and a cycle on each side. The two sides are independent of the dashboard above.</p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SideBlock
          label="Pond A"
          color={colorA}
          active={applied != null}
          ponds={ponds}
          pondId={leftPond}
          cycleId={leftCycle}
          onPond={(pid) => { setLeftPond(pid); setLeftCycle(null); }}
          onCycle={setLeftCycle}
        />
        <SideBlock
          label="Pond B"
          color={colorB}
          active={applied != null}
          ponds={ponds}
          pondId={rightPond}
          cycleId={rightCycle}
          onPond={(pid) => { setRightPond(pid); setRightCycle(null); }}
          onCycle={setRightCycle}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
        {applied ? (
          <button
            type="button"
            onClick={() => {
              setLeftPond(null);
              setLeftCycle(null);
              setRightPond(null);
              setRightCycle(null);
              onClear();
            }}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Clear comparison
          </button>
        ) : (
          <span className="text-[11px] text-gray-400">Nothing is compared yet.</span>
        )}
        <div className="flex items-center gap-2.5">
          {sameCycle && <span className="text-[11px] font-semibold text-amber-700">Pick two different cycles.</span>}
          {applied && (
            <button
              type="button"
              onClick={() => setConfigOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:border-gray-300"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => leftCycle && rightCycle && onApply(leftCycle, rightCycle)}
            disabled={!ready || isApplied}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            Apply comparison
          </button>
        </div>
      </div>
    </div>
  );
}
