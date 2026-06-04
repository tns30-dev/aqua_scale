import { useState } from "react";
import { Calendar, ChevronDown, Download, Info } from "lucide-react";
import { clsx } from "clsx";
import type { GroupBy, QuickRange } from "./types";

const QUICK_RANGES: { id: QuickRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "custom", label: "Custom" },
];

/**
 * Filter bar — Date Range, Quick Range, Group By, Compare With, Export.
 * Quick Range + Group By are controlled by the page (they drive the fetch);
 * Compare With + Export remain local/cosmetic for now.
 */
export function EnergyFilters({
  dateRangeLabel,
  quick,
  onQuickChange,
  groupBy,
  onGroupByChange,
}: {
  dateRangeLabel: string;
  quick: QuickRange;
  onQuickChange: (q: QuickRange) => void;
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
}) {
  const [compareWith, setCompareWith] = useState("previous-7");

  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* Date Range */}
      <Field label="Date Range">
        <button className="flex h-10 min-w-[230px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="flex-1 text-left">{dateRangeLabel}</span>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>
      </Field>

      {/* Quick Range */}
      <Field label="Quick Range">
        <div className="inline-flex h-10 items-center rounded-lg border border-gray-300 bg-white p-0.5">
          {QUICK_RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => onQuickChange(r.id)}
              className={clsx(
                "h-full rounded-md px-3 text-sm font-medium transition",
                quick === r.id
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-600 hover:text-gray-900",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </Field>

      {/* Group By */}
      <Field label="Group By">
        <Select value={groupBy} onChange={(v) => onGroupByChange(v as GroupBy)}>
          <option value="hour">Hour</option>
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </Select>
      </Field>

      {/* Compare With */}
      <Field label={<span className="flex items-center gap-1">Compare With <Info className="h-3 w-3 text-gray-400" /></span>}>
        <Select value={compareWith} onChange={setCompareWith}>
          <option value="previous-7">Previous 7 Days</option>
          <option value="previous-period">Previous Period</option>
          <option value="none">No Comparison</option>
        </Select>
      </Field>

      <div className="ml-auto">
        <button className="flex h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 min-w-[150px] appearance-none rounded-lg border border-gray-300 bg-white pl-3 pr-9 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  );
}
