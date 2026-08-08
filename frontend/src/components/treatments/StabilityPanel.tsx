import { useState } from "react";
import { Droplets, Eye, EyeOff, TriangleAlert } from "lucide-react";
import { useProfileTheme } from "../../context/ProfileContext";
import { Card, CardContent } from "../ui/card";
import { C, hexA, stabColor, stabInk, windowDays, windowLabel, type StabRow } from "./data";
import { ElectricityPanel } from "./ElectricityPanel";
import { TreatmentCostPanel } from "./TreatmentCostPanel";
import { useTip } from "./Tooltip";
import type { TreatmentCostRow } from "../../types";

// THE component (treatment_stability.md, 27 Jul 2026): one horizontal bar
// chart replacing the old comparison panels. A row per watched parameter =
// the share of readings inside its safe range over the window when all
// selected treatments were in the water together; the hero is overall
// stability (every watched parameter safe at the same moment). The
// product ↔ parameter badges hide behind the eye toggle; the not-included
// notice is a SUGGESTION, amber on purpose — red is reserved for alerts
// in this system.

type ValueMode = "pct" | "count";

interface Props {
  pond: string;
  selectedNames: string[];
  activeParams: StabRow[];
  badges: Record<string, string[]>;
  overall: StabRow | null;
  power: { kwh: number; cost: number; tariff: number; currency: string } | null;
  tcost: { courses: TreatmentCostRow[]; total: number; currency: string } | null;
  window: { start: string; end: string };
  todayIso: string;
  missingNames: string[];
  onIncludeAll: () => void;
}

function Bar({ row, mode, big }: { row: StabRow; mode: ValueMode; big?: boolean }) {
  const tip = useTip();
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex-1 overflow-hidden rounded-full ${big ? "h-5" : "h-4"}`}
        style={{ background: C.track }}
        {...tip(`${row.name} stable ${row.pct}% of the time · ${row.safe} of ${row.total} readings`)}
      >
        <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: stabColor(row.pct) }} />
      </div>
      <span className={`whitespace-nowrap text-right font-mono font-bold tabular-nums ${big ? "w-[86px] text-[16px] text-gray-900" : "w-[80px] text-[13px] text-gray-900"}`}>
        {mode === "pct" ? `${row.pct}%` : `${row.safe}/${row.total}`}
      </span>
    </div>
  );
}

export function StabilityPanel({ pond, selectedNames, activeParams, badges, overall, power, tcost, window: win, todayIso, missingNames, onIncludeAll }: Props) {
  const theme = useProfileTheme();
  const [mode, setMode] = useState<ValueMode>("pct");
  const [showAssoc, setShowAssoc] = useState(false);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {missingNames.length > 0 && (
          <button
            type="button"
            onClick={onIncludeAll}
            className="flex w-full items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-left transition-colors hover:border-amber-400"
          >
            <TriangleAlert className="h-5 w-5 flex-none text-amber-500" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold text-amber-900">{missingNames.join(" · ")} also in the water during this period</span>
              <span className="block text-[12px] text-amber-800/90">We recommend including {missingNames.length === 1 ? "it" : "them"} so the claim covers everything that was helping.</span>
            </span>
            <span className="flex-none rounded-lg bg-amber-500 px-3 py-2 text-[12px] font-bold text-white">Include</span>
          </button>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-500">Analysis period · {pond}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-[24px] font-bold leading-tight tracking-tight text-gray-800">{windowLabel(win, todayIso)}</span>
              <span className="rounded-full bg-teal-50 px-2.5 py-1 font-mono text-[13px] font-bold tabular-nums text-teal-700 ring-1 ring-teal-200">{windowDays(win, todayIso)} days</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="mr-0.5 text-[12px] text-gray-500">in the water together:</span>
              {selectedNames.map((n) => (
                <span key={n} className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[12px] font-bold text-gray-900">{n}</span>
              ))}
            </div>
          </div>
          <div className="flex rounded-lg bg-gray-100 p-0.5">
            {([["pct", "Percent"], ["count", "Readings"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors ${mode === value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {overall && (
          <div
            className="rounded-xl border p-3.5"
            style={{ borderColor: hexA(theme.primary, 0.4), backgroundColor: hexA(theme.primary, 0.04) }}
          >
            <div className="font-mono text-[11px] font-bold uppercase tracking-widest" style={{ color: theme.primary }}>Overall stability</div>
            <div className="mt-1.5 flex items-end gap-4">
              <span className="text-[44px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: stabInk(overall.pct) }}>{overall.pct}%</span>
              <span className="pb-1 text-[13.5px] leading-snug text-gray-700">of the time, every watched parameter was safe at once.</span>
            </div>

            <div className="mt-2.5">
              <Bar row={overall} mode={mode} big />
            </div>
          </div>
        )}

        {activeParams.length > 0 ? (
          <div
            className="rounded-xl border p-3.5"
            style={{ borderColor: hexA(theme.primary, 0.4), backgroundColor: hexA(theme.primary, 0.04) }}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest" style={{ color: theme.primary }}>
                <Droplets className="h-4 w-4" /> Water quality watched · {activeParams.length} parameters
              </span>
              <button
                type="button"
                onClick={() => setShowAssoc((v) => !v)}
                aria-pressed={showAssoc}
                className={`inline-flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 font-mono text-[10px] font-semibold transition-colors ${showAssoc ? "" : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"}`}
                style={showAssoc ? { borderColor: hexA(theme.primary, 0.6), backgroundColor: hexA(theme.primary, 0.08), color: theme.primary } : undefined}
              >
                {showAssoc ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showAssoc ? "Hide treatments" : "Show treatments"}
              </button>
            </div>
            {activeParams.map((p) => (
              <div
                key={p.name}
                className="grid grid-cols-1 items-center gap-x-4 gap-y-1 border-t py-2.5 sm:grid-cols-[180px_1fr]"
                style={{ borderTopColor: hexA(theme.primary, 0.15) }}
              >
                <div className="min-w-0">
                  <span className="block text-[15px] font-semibold text-gray-900">{p.name}</span>
                  {showAssoc && (
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {(badges[p.name] ?? []).map((b) => (
                        <span key={b} className="whitespace-nowrap rounded-full border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-gray-600">{b}</span>
                      ))}
                    </span>
                  )}
                </div>
                <Bar row={p} mode={mode} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-500">No readings in this period, so there is nothing to measure yet.</p>
          </div>
        )}

        {(power || tcost) && (
          <div className={`grid grid-cols-1 gap-4 ${power && tcost ? "lg:grid-cols-2" : ""}`}>
            {power && <ElectricityPanel win={win} todayIso={todayIso} power={power} />}
            {tcost && <TreatmentCostPanel tcost={tcost} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
