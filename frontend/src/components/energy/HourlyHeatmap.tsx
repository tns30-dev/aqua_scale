import { Fragment } from "react";
import { EnergyCard } from "./EnergyCard";
import type { HeatmapData } from "./types";

const LIGHT = [236, 253, 245]; // emerald-50
const DARK = [4, 120, 87]; // emerald-700

/** null = No Data → grey, never green/0 (req §25). */
function colorFor(value: number | null, max: number): string {
  if (value === null) return "#f3f4f6"; // gray-100
  const t = Math.max(0, Math.min(1, value / max));
  const ch = (i: number) => Math.round(LIGHT[i] + (DARK[i] - LIGHT[i]) * t);
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
}

export function HourlyHeatmap({ data }: { data: HeatmapData }) {
  const { dateLabels, hourLabels, matrix, maxValue } = data;

  return (
    <EnergyCard title="Hourly Consumption Heatmap (kWh)">
      <div className="flex gap-4">
        {/* Grid */}
        <div
          className="grid flex-1"
          style={{ gridTemplateColumns: `44px repeat(${dateLabels.length}, minmax(0, 1fr))`, gap: "2px" }}
        >
          {matrix.map((row, h) => (
            <Fragment key={h}>
              <div className="flex items-center justify-end pr-1 text-[10px] text-gray-400">
                {h % 4 === 0 ? hourLabels[h] : ""}
              </div>
              {row.map((v, d) => (
                <div
                  key={d}
                  title={
                    v === null
                      ? `${dateLabels[d]}, ${hourLabels[h]} — No Data`
                      : `${dateLabels[d]}, ${hourLabels[h]} — ${v.toFixed(1)} kWh`
                  }
                  className="h-3.5 rounded-[3px]"
                  style={{ background: colorFor(v, maxValue) }}
                />
              ))}
            </Fragment>
          ))}

          {/* Bottom date axis */}
          <div />
          {dateLabels.map((dl) => (
            <div key={dl} className="pt-1.5 text-center text-[10px] text-gray-400">
              {dl}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-col items-center pt-1">
          <span className="mb-1 text-[10px] text-gray-400">kWh</span>
          <div className="flex gap-1">
            <div
              className="h-40 w-3 rounded"
              style={{ background: `linear-gradient(to top, rgb(${LIGHT.join(",")}), rgb(${DARK.join(",")}))` }}
            />
            <div className="flex h-40 flex-col justify-between text-[10px] text-gray-400">
              <span>{maxValue}</span>
              <span>{Math.round(maxValue * 0.6)}</span>
              <span>{Math.round(maxValue * 0.2)}</span>
              <span>0</span>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-[11px] text-gray-400">
        Darker color indicates higher electricity consumption.
      </p>
    </EnergyCard>
  );
}
