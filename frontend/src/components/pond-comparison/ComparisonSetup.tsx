import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { dayCount, fmtDay, hexA, isoDaysAgo, todayIso } from "./format";
import type { PondComparisonPondOption } from "../../types";

interface ComparisonSetupProps {
  ponds: PondComparisonPondOption[];
  pondAId: string;
  pondBId: string;
  fromDate: string;
  toDate: string;
  onPondAChange: (pondId: string) => void;
  onPondBChange: (pondId: string) => void;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  onApply: () => void;
  applyDisabled: boolean;
  validationHint: string;
  appliedRange: { startDate: string; endDate: string } | null;
  themeColor: string;
  colorA: string;
  colorB: string;
  parametersRow?: ReactNode;
}

const QUICK_RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
] as const;

function Field({
  label,
  dotColor,
  children,
}: {
  label: string;
  dotColor?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500"
        style={dotColor ? { color: dotColor } : undefined}
      >
        {dotColor && (
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
        )}
        {label}
      </span>
      {children}
    </label>
  );
}

function PondField({
  label,
  color,
  ponds,
  value,
  onChange,
}: {
  label: string;
  color: string;
  ponds: PondComparisonPondOption[];
  value: string;
  onChange: (pondId: string) => void;
}) {
  const sorted = [...ponds].sort(
    (a, b) => Number(b.hasSensorData) - Number(a.hasSensorData),
  );
  return (
    <Field label={label} dotColor={color}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-56 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800"
      >
        <option value="">Choose a pond</option>
        {sorted.map((pond) => (
          <option key={pond.pondId} value={pond.pondId}>
            {pond.name}
            {!pond.hasSensorData ? " - no readings yet" : ""}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function ComparisonSetup({
  ponds,
  pondAId,
  pondBId,
  fromDate,
  toDate,
  onPondAChange,
  onPondBChange,
  onFromDateChange,
  onToDateChange,
  onApply,
  applyDisabled,
  validationHint,
  appliedRange,
  themeColor,
  colorA,
  colorB,
  parametersRow,
}: ComparisonSetupProps) {
  const preset = QUICK_RANGES.find(
    (range) => fromDate === isoDaysAgo(range.days) && toDate === todayIso(),
  );
  const sameYear = appliedRange
    ? appliedRange.startDate.slice(0, 4) === appliedRange.endDate.slice(0, 4)
    : true;

  const pickPreset = (days: number) => {
    onFromDateChange(isoDaysAgo(days));
    onToDateChange(todayIso());
  };

  return (
    <div
      className="mb-4 space-y-3 rounded-lg border-2 p-3 sm:p-4"
      style={{ borderColor: hexA(themeColor, 0.55), backgroundColor: hexA(themeColor, 0.03) }}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <PondField label="Pond A" color={colorA} ponds={ponds} value={pondAId} onChange={onPondAChange} />
          <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 font-mono text-[11px] font-black uppercase text-white shadow">
            vs
          </span>
          <PondField label="Pond B" color={colorB} ponds={ponds} value={pondBId} onChange={onPondBChange} />

          <Field label="Date range">
            <div className="flex h-10 items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5">
              {QUICK_RANGES.map((range) => {
                const active = preset?.days === range.days;
                return (
                  <button
                    key={range.label}
                    type="button"
                    onClick={() => pickPreset(range.days)}
                    className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                      active ? "" : "text-gray-500 hover:bg-gray-100"
                    }`}
                    style={active ? { backgroundColor: hexA(themeColor, 0.08), color: themeColor } : undefined}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="From">
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(event) => onFromDateChange(event.target.value)}
                className="h-10 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-800"
              />
            </div>
          </Field>

          <Field label="To">
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={toDate}
                onChange={(event) => onToDateChange(event.target.value)}
                className="h-10 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-800"
              />
            </div>
          </Field>

          <button
            type="button"
            onClick={onApply}
            disabled={applyDisabled}
            className="h-10 rounded-lg px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: themeColor }}
          >
            Apply comparison
          </button>
        </div>

        {appliedRange && (
          <div className="flex flex-col items-start gap-1 md:items-end">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Analysis period
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xl font-bold tracking-tight text-gray-900">
                {fmtDay(appliedRange.startDate, !sameYear)} to {fmtDay(appliedRange.endDate, true)}
              </span>
              <span
                className="rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold"
                style={{ backgroundColor: hexA(themeColor, 0.08), color: themeColor }}
              >
                {dayCount(appliedRange.startDate, appliedRange.endDate)} days
              </span>
            </div>
          </div>
        )}
      </div>

      {parametersRow && (
        <div className="border-t pt-2.5" style={{ borderTopColor: hexA(themeColor, 0.18) }}>
          {parametersRow}
        </div>
      )}

      {validationHint && (
        <p className="text-[11px] font-semibold text-red-600">{validationHint}</p>
      )}
    </div>
  );
}
