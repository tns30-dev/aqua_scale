import React from "react";
import type { ChangeType } from "../../utils/abTesting";

// Types
export interface MetricCardProps {
  /** Parameter name (e.g., "AMMONIUM") */
  label: string;

  /** Pond name (e.g., "POND ALPHA-01") */
  pondName: string;

  /** Current value */
  value: number;

  /** Unit label (e.g., "mg/L", "NTU", "kWh") */
  unit: string;

  /** Change text — e.g. "v 52% lower (-1.07 mg/L)", empty for the baseline-side card */
  changeText: string;

  /** positive = better than the other pond (green), warning = worse (amber), neutral = no change (gray) */
  changeType: ChangeType;

  /** Accent color for the card left border — from comparison color or profile theme */
  themeColor?: string;
}

// Constants
const CHANGE_COLORS: Record<ChangeType, string> = {
  positive: "text-green-600",
  warning: "text-amber-600",
  neutral: "text-gray-400",
};

// Components
export const MetricCard = React.memo(function MetricCard({
  label,
  pondName,
  value,
  unit,
  changeText,
  changeType,
  themeColor,
}: MetricCardProps) {
  const color = themeColor ?? "#0C9286";

  return (
    <div
      className="rounded-lg border px-3 py-2.5"
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
        borderLeftWidth: 3,
        borderLeftColor: color,
      }}
    >
      {/* Label */}
      <p
        className="text-[9px] font-semibold uppercase tracking-wide"
        style={{ color }}
      >
        {label} ({pondName})
      </p>

      {/* Value */}
      <p className="mt-1">
        <span
          className="text-xl font-bold"
          style={{ color }}
        >
          {value}
        </span>
        <span className="ml-1 text-[11px] text-gray-400">{unit}</span>
      </p>

      {/* Change indicator */}
      <p
        className={`mt-0.5 text-[10px] font-semibold ${CHANGE_COLORS[changeType]}`}
      >
        {changeText}
      </p>
    </div>
  );
});
