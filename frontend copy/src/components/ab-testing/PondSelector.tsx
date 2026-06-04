import React from "react";
import type { PondComparisonPondOption } from "../../types";
import { formatOptionLabel } from "../../utils/abTesting";

// Types
export interface PondSelectorProps {
  /** "treatment" shows theme badge, "baseline" shows gray badge */
  role: "treatment" | "baseline";

  /** Label shown on badge (e.g., "POND A", "POND B") */
  badgeLabel: string;

  /** Available ponds to select from */
  options: PondComparisonPondOption[];

  /** Currently selected pond ID */
  selectedPondId: string;

  /** Called when selection changes */
  onChange: (pondId: string) => void;

  /** Theme color for treatment badge */
  themeColor?: string;
}

// Component
export const PondSelector = React.memo(function PondSelector({
  role,
  badgeLabel,
  options,
  selectedPondId,
  onChange,
  themeColor,
}: PondSelectorProps) {
  const isTreatment = role === "treatment";

  return (
    <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <span
        className="shrink-0 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
        style={
          themeColor
            ? isTreatment
              ? { backgroundColor: `${themeColor}20`, color: themeColor }
              : { backgroundColor: `${themeColor}15`, color: `${themeColor}90` }
            : { backgroundColor: "#f3f4f6", color: "#6b7280" }
        }
      >
        {badgeLabel}
      </span>
      <select
        value={selectedPondId}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700"
      >
        {options.map((pond) => (
          <option key={pond.pondId} value={pond.pondId}>
            {formatOptionLabel(pond)}
          </option>
        ))}
      </select>
    </div>
  );
});
