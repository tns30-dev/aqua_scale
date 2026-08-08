import { FlaskConical } from "lucide-react";
import { useProfileTheme } from "../../context/ProfileContext";
import { C, hexA } from "./data";
import type { TreatmentCostRow } from "../../types";

// Treatment cost block (dose arc · 29 Jul 2026): what the products
// themselves cost — the sibling of the electricity block, same template
// tint. Per-course rows carry the recorded amount; the hero is the total.
// Binary rule: the parent only renders this when at least one selected
// course has a recorded dose AND a priced product.

interface Props {
  tcost: { courses: TreatmentCostRow[]; total: number; currency: string };
}

export function TreatmentCostPanel({ tcost }: Props) {
  const theme = useProfileTheme();
  const currency = tcost.currency || "S$";

  return (
    <div
      className="rounded-xl border p-3.5"
      style={{ borderColor: hexA(theme.primary, 0.4), backgroundColor: hexA(theme.primary, 0.04) }}
    >
      <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest" style={{ color: theme.primary }}>
        <FlaskConical className="h-4 w-4" /> Treatment cost · products used
      </div>
      <div className="mt-2">
        <span className="text-[44px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: C.goodInk }}>{currency}&nbsp;{tcost.total}</span>
        <p className="mt-1.5 text-[13px] text-gray-700">spent on the treatments in this analysis.</p>
      </div>
      <div className="mt-3.5 flex flex-col border-t pt-1" style={{ borderTopColor: hexA(theme.primary, 0.2) }}>
        {tcost.courses.map((row, i) => (
          <div key={`${row.name}-${i}`} className="flex items-center gap-3 py-2" style={i > 0 ? { borderTop: `1px solid ${hexA(theme.primary, 0.12)}` } : undefined}>
            <span className="min-w-0 flex-1 text-[14px] font-semibold text-gray-900">{row.name}</span>
            <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-gray-600 ring-1 ring-gray-200">{row.amount} {row.unit}</span>
            <span className="w-[90px] text-right font-mono text-[14px] font-bold tabular-nums text-gray-900">{currency} {row.cost}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
