import React from "react";

// Types
export interface DateRangePickerProps {
  /** Start date (YYYY-MM-DD) */
  fromDate: string;

  /** End date (YYYY-MM-DD) */
  toDate: string;

  /** Called when FROM date changes */
  onFromChange: (date: string) => void;

  /** Called when TO date changes */
  onToChange: (date: string) => void;
}

// Component
export const DateRangePicker = React.memo(function DateRangePicker({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
}: DateRangePickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase text-gray-500">
        From
      </span>
      <input
        type="date"
        value={fromDate}
        onChange={(e) => onFromChange(e.target.value)}
        className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-normal text-gray-700"
      />
      <span className="text-[10px] font-semibold uppercase text-gray-500">
        To
      </span>
      <input
        type="date"
        value={toDate}
        onChange={(e) => onToChange(e.target.value)}
        className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-normal text-gray-700"
      />
    </div>
  );
});