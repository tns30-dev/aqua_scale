import { useState } from "react";
import { Calendar, ChevronDown, Download, Info, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import type { CompareMode, GroupBy, QuickRange } from "./types";

const QUICK_RANGES: { id: QuickRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "custom", label: "Custom" },
];

const MAX_SPAN_DAYS = 366;

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function EnergyFilters({
  dateRangeLabel,
  quick,
  onQuickChange,
  groupBy,
  onGroupByChange,
  startDate,
  endDate,
  onRangeChange,
  compare,
  onCompareChange,
  previousRangeLabel,
  onExport,
  exporting,
}: {
  dateRangeLabel: string;
  quick: QuickRange;
  onQuickChange: (q: QuickRange) => void;
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
  startDate: string;
  endDate: string;
  onRangeChange: (startDate: string, endDate: string) => void;
  compare: CompareMode;
  onCompareChange: (c: CompareMode) => void;
  previousRangeLabel?: string;
  onExport: () => void;
  exporting: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);

  const today = isoToday();
  const spanDays =
    draftStart && draftEnd
      ? (new Date(draftEnd).getTime() - new Date(draftStart).getTime()) / 86400000 + 1
      : 0;
  const hint =
    spanDays < 1
      ? "End date must be on or after start date."
      : spanDays > MAX_SPAN_DAYS
        ? `Range cannot exceed ${MAX_SPAN_DAYS} days.`
        : null;

  const openPicker = () => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setPickerOpen(true);
  };

  const apply = () => {
    onRangeChange(draftStart, draftEnd);
    setPickerOpen(false);
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      <Field label="Date Range">
        <div className="relative">
          <button
            onClick={() => (pickerOpen ? setPickerOpen(false) : openPicker())}
            className="flex h-10 min-w-[230px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="flex-1 text-left">{dateRangeLabel}</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
              <div className="absolute left-0 top-11 z-20 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
                    Start date
                    <input
                      type="date"
                      value={draftStart}
                      max={today}
                      onChange={(e) => setDraftStart(e.target.value)}
                      className="h-9 rounded-lg border border-gray-300 px-2 text-sm text-gray-700 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
                    End date
                    <input
                      type="date"
                      value={draftEnd}
                      max={today}
                      onChange={(e) => setDraftEnd(e.target.value)}
                      className="h-9 rounded-lg border border-gray-300 px-2 text-sm text-gray-700 focus:outline-none"
                    />
                  </label>
                  {hint && <p className="text-xs text-red-500">{hint}</p>}
                  <button
                    onClick={apply}
                    disabled={!!hint || !draftStart || !draftEnd}
                    className="h-9 rounded-lg bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </Field>

      <Field label="Quick Range">
        <div className="inline-flex h-10 items-center rounded-lg border border-gray-300 bg-white p-0.5">
          {QUICK_RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => (r.id === "custom" ? openPicker() : onQuickChange(r.id))}
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

      <Field label="Group By">
        <Select value={groupBy} onChange={(v) => onGroupByChange(v as GroupBy)}>
          <option value="hour">Hour</option>
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </Select>
      </Field>

      <Field
        label={
          <span className="flex items-center gap-1">
            Compare With
            <span
              title={
                "Previous period uses the same duration immediately before the selected date range." +
                (previousRangeLabel ? ` Previous: ${previousRangeLabel}.` : "")
              }
            >
              <Info className="h-3 w-3 text-gray-400" />
            </span>
          </span>
        }
      >
        <Select value={compare} onChange={(v) => onCompareChange(v as CompareMode)}>
          <option value="previous">Previous Period</option>
          <option value="none">No Comparison</option>
        </Select>
      </Field>

      <div className="ml-auto flex flex-col items-end gap-1">
        <button
          onClick={onExport}
          disabled={exporting}
          title={`Export Excel for ${dateRangeLabel}`}
          className="flex h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? "Exporting..." : "Export"}
        </button>
        <span
          title={dateRangeLabel}
          className="inline-flex max-w-[180px] items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700"
        >
          <Calendar className="h-3 w-3 shrink-0 text-emerald-500" />
          <span className="truncate">{dateRangeLabel}</span>
        </span>
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
