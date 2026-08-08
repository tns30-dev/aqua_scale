import { ArrowDown, ArrowUp, Minus } from "lucide-react";

export interface MetricChip {
  label: string;
  direction: "up" | "down" | "same";
  tone: "good" | "bad" | "neutral";
}

const CHIP_TONES: Record<MetricChip["tone"], string> = {
  good: "bg-emerald-50 text-emerald-700",
  bad: "bg-red-50 text-red-700",
  neutral: "bg-gray-100 text-gray-500",
};

interface MetricCardProps {
  label: string;
  value: number;
  unit: string;
  hasReadings: boolean;
  chip: MetricChip | null;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function ChipIcon({ direction }: { direction: MetricChip["direction"] }) {
  if (direction === "down") return <ArrowDown className="h-3 w-3" />;
  if (direction === "up") return <ArrowUp className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
}

export function MetricCard({ label, value, unit, hasReadings, chip }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <p className="text-[9.5px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      {hasReadings ? (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span className="text-lg font-bold tabular-nums text-gray-900">{formatNumber(value)}</span>
          <span className="text-[11px] text-gray-500">{unit}</span>
          {chip && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px align-middle text-[10px] font-bold ${CHIP_TONES[chip.tone]}`}
            >
              <ChipIcon direction={chip.direction} />
              {chip.label}
            </span>
          )}
        </p>
      ) : (
        <>
          <p className="mt-1 text-lg font-bold text-gray-400">-</p>
          <p className="text-[11px] text-gray-500">No readings this period</p>
        </>
      )}
    </div>
  );
}
