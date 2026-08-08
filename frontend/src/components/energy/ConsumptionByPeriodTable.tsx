import { ChevronsUpDown } from "lucide-react";
import { EnergyCard } from "./EnergyCard";
import type { ByPeriodRow } from "./types";

export function ConsumptionByPeriodTable({ title, rows }: { title: string; rows: ByPeriodRow[] }) {
  const ordered = [...rows].reverse();

  return (
    <EnergyCard
      title={`${title} (${rows.length})`}
      info="Total consumption per period for the selected range and Group By. Periods without data have no row."
    >
      <div className="max-h-[330px] overflow-y-auto pr-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500">
              <th className="pb-2">Date</th>
              <th className="pb-2">
                <span className="flex items-center justify-end gap-1">
                  kWh <ChevronsUpDown className="h-3 w-3 text-gray-400" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((r) => (
              <tr key={r.label} className="border-b border-gray-100 last:border-0">
                <td className="py-2.5 text-gray-700">{r.label}</td>
                <td className="py-2.5 text-right font-medium text-gray-900">{r.kwh.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </EnergyCard>
  );
}
