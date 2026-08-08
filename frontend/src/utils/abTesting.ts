import type { PondComparisonPondOption } from "../types";

export type ChangeType = "positive" | "warning" | "neutral";

export interface ChangeResult {
  text: string;
  type: ChangeType;
}

/**
 * Calculate change between Pond A and Pond B values for a single metric.
 *
 * Naming is positional, not treatment/baseline: Pond A is "first selection",
 * Pond B is "second selection". The backend never infers which one is
 * treated; this util follows the same convention (see
 * pond_comparision_reference/api_response_shape.md Rule 4).
 *
 * positive = Pond A is better than Pond B (green)
 * warning  = Pond A is worse than Pond B (amber — currently unused, reserved)
 * neutral  = no change, no comparison possible, or change is irrelevant
 */
export function calculateChange(
  pondAValue: number,
  pondBValue: number,
  lowerIsBetter: boolean | null,
  unit: string,
): ChangeResult {
  if (pondBValue === 0) return { text: "No comparison", type: "neutral" };

  const diff = pondAValue - pondBValue;
  const percent = Math.round((diff / pondBValue) * 100);

  if (percent === 0) return { text: "No change", type: "neutral" };

  const isLower = percent < 0;
  const absPercent = Math.abs(percent);
  const absDiff = Math.abs(diff).toFixed(2);
  const direction = isLower ? "lower" : "higher";
  const arrow = isLower ? "v" : "^";
  const sign = isLower ? "-" : "+";
  if (lowerIsBetter === null) {
    return {
      text: `${arrow} ${absPercent}% ${direction} (${sign}${absDiff} ${unit})`,
      type: "neutral",
    };
  }
  const isGood = lowerIsBetter ? isLower : !isLower;

  return {
    text: isGood
      ? `${arrow} ${absPercent}% ${direction} (${sign}${absDiff} ${unit})`
      : "",
    type: isGood ? "positive" : "neutral",
  };
}

export function formatOptionLabel(pond: PondComparisonPondOption): string {
  return pond.name;
}
