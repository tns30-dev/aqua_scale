import React from "react";
import { PondSelector } from "./PondSelector";
import { DateRangePicker } from "../common/DateRangePicker";
import type { PondComparisonPondOption } from "../../types";

// Types
export interface ComparisonConfigProps {
  /** Available ponds (fetched on mount) */
  ponds: PondComparisonPondOption[];

  /** Selected pond A ID */
  pondAId: string;

  /** Selected pond B ID */
  pondBId: string;

  /** Date range start (YYYY-MM-DD) */
  fromDate: string;

  /** Date range end (YYYY-MM-DD) */
  toDate: string;

  /** Callbacks */
  onPondAChange: (pondId: string) => void;
  onPondBChange: (pondId: string) => void;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  onApply: () => void;

  /** Theme color from profile */
  themeColor?: string;

  /** Pond A comparison color */
  colorA?: string;

  /** Pond B comparison color */
  colorB?: string;
}

// Component
export const ComparisonConfig = React.memo(function ComparisonConfig({
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
  themeColor,
  colorA,
  colorB,
}: ComparisonConfigProps) {
  return (
    <div className="mb-4 space-y-3">
      {/* Pond selectors row */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <PondSelector
          role="treatment"
          badgeLabel="Pond A"
          options={ponds}
          selectedPondId={pondAId}
          onChange={onPondAChange}
          themeColor={colorA || themeColor}
        />

        <span className="hidden text-[11px] font-bold text-gray-300 md:block">
          VS
        </span>

        <PondSelector
          role="treatment"
          badgeLabel="Pond B"
          options={ponds}
          selectedPondId={pondBId}
          onChange={onPondBChange}
          themeColor={colorB || themeColor}
        />
      </div>

      {/* Date range + Apply */}
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={onFromDateChange}
          onToChange={onToDateChange}
        />
        <button
          onClick={onApply}
          className="rounded-md bg-gray-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
        >
          Apply
        </button>
      </div>
    </div>
  );
});
