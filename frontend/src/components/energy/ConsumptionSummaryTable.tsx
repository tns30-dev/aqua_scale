import { ArrowDown } from "lucide-react";
import { clsx } from "clsx";
import { EnergyCard } from "./EnergyCard";
import type { SummaryRow } from "./types";

export function ConsumptionSummaryTable({ rows }: { rows: SummaryRow[] }) {
  return (
    <EnergyCard title="Consumption Summary">
      <div className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500">
              <th className="pb-2">Metric</th>
              <th className="pb-2 text-right">Current Period</th>
              <th className="pb-2 text-right">Previous Period</th>
              <th className="pb-2 text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.metric} className="border-b border-gray-100 last:border-0">
                <td className="py-2.5 text-gray-700">{r.metric}</td>
                <td className="py-2.5 text-right font-medium text-gray-900">{r.current}</td>
                <td className="py-2.5 text-right text-gray-500">{r.previous}</td>
                <td className="py-2.5 text-right">
                  <span
                    className={clsx(
                      "inline-flex items-center gap-0.5 font-semibold",
                      r.improved ? "text-emerald-600" : "text-amber-600",
                    )}
                  >
                    <ArrowDown className="h-3 w-3" />
                    {r.change}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 border-t border-gray-100 pt-3 text-[11px] leading-relaxed text-gray-400">
        Previous period uses the same duration immediately before the selected date range.
        Since the current range is 1 Jun - 7 Jun 2026, the previous period is 25 May - 31 May 2026.
      </p>
    </EnergyCard>
  );
}
