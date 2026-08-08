import { useState } from "react";
import { MapPin } from "lucide-react";
import { MetricCard, type MetricChip } from "./MetricCard";
import { fmtDay } from "./format";
import type { PondComparisonMetric, PondWindowTreatment } from "../../types";

interface PondPanelProps {
  sideLabel: string;
  side: "A" | "B";
  color: string;
  name: string;
  gpsLocation: string;
  treatments: PondWindowTreatment[];
  metrics: PondComparisonMetric[];
}

function chipFor(metric: PondComparisonMetric): MetricChip | null {
  if (!metric.pondAHasReadings || !metric.pondBHasReadings || metric.pondBValue === 0) {
    return null;
  }
  const diff = metric.pondAValue - metric.pondBValue;
  const absPercent = Number((Math.abs(diff / metric.pondBValue) * 100).toFixed(1));
  if (absPercent === 0) {
    return { label: "Same", direction: "same", tone: "neutral" };
  }

  const lower = diff < 0;
  const direction = lower ? "down" : "up";
  const label = `${absPercent}% ${lower ? "lower" : "higher"}`;
  if (metric.lowerIsBetter === null) {
    return { label, direction, tone: "neutral" };
  }
  const good = metric.lowerIsBetter ? lower : !lower;
  return { label, direction, tone: good ? "good" : "bad" };
}

const CHIP_LIMIT = 6;

export function PondPanel({
  sideLabel,
  side,
  color,
  name,
  gpsLocation,
  treatments,
  metrics,
}: PondPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleTreatments = expanded ? treatments : treatments.slice(0, CHIP_LIMIT);

  return (
    <div className="rounded-lg border-2 bg-white p-4" style={{ borderColor: color }}>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
        {sideLabel}
      </p>
      <p className="text-sm font-bold text-gray-900">{name}</p>

      {treatments.length > 0 && (
        <div className="mt-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">
            In the water this period
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {visibleTreatments.map((treatment, index) => (
              <span
                key={`${treatment.code}-${treatment.startedAt}-${index}`}
                title={`${fmtDay(treatment.startedAt, true)} to ${
                  treatment.endedAt ? fmtDay(treatment.endedAt, true) : "ongoing"
                }`}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700"
              >
                <span className="font-semibold">{treatment.name}</span>
                {` from ${fmtDay(treatment.startedAt)} to ${
                  treatment.endedAt ? fmtDay(treatment.endedAt) : "today"
                }`}
              </span>
            ))}
            {treatments.length > CHIP_LIMIT && (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: `${color}14`, color }}
              >
                {expanded ? "Show less" : `+${treatments.length - CHIP_LIMIT} more`}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.parameter}
            label={metric.label}
            value={side === "A" ? metric.pondAValue : metric.pondBValue}
            unit={metric.unit}
            hasReadings={side === "A" ? metric.pondAHasReadings : metric.pondBHasReadings}
            chip={side === "A" ? chipFor(metric) : null}
          />
        ))}
      </div>

      {gpsLocation && (
        <p className="mt-3 flex items-center gap-1 text-[11px] text-gray-500">
          <MapPin className="h-3 w-3" />
          {gpsLocation}
        </p>
      )}
    </div>
  );
}
