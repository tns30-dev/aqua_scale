import { Fragment } from "react";
import { EnergyCard } from "./EnergyCard";
import type { HeatmapData } from "./types";

const LIGHT = [236, 253, 245];
const DARK = [4, 120, 87];
const MAX_HEATMAP_DAYS = 31;

function colorFor(value: number | null, max: number): string {
  if (value === null) return "#f3f4f6";
  const safeMax = Math.max(max, 1);
  const t = Math.max(0, Math.min(1, value / safeMax));
  const ch = (i: number) => Math.round(LIGHT[i] + (DARK[i] - LIGHT[i]) * t);
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
}

export function HourlyHeatmap({ data }: { data: HeatmapData }) {
  const { hourLabels } = data;
  const clipped = data.dateLabels.length > MAX_HEATMAP_DAYS;
  const dateLabels = clipped ? data.dateLabels.slice(-MAX_HEATMAP_DAYS) : data.dateLabels;
  const matrix = clipped ? data.matrix.map((row) => row.slice(-MAX_HEATMAP_DAYS)) : data.matrix;
  const maxValue =
    matrix.reduce<number>(
      (m, row) => row.reduce<number>((mm, v) => (v !== null && v > mm ? v : mm), m),
      0,
    ) || data.maxValue;
  const labelStep = Math.ceil(dateLabels.length / 8);

  return (
    <EnergyCard
      title="Hourly Consumption Heatmap (kWh)"
      info="kWh for each hour of day across the selected range. Darker is higher. Grey cells are missing hours."
    >
      {clipped && (
        <p className="mb-2 text-[11px] font-medium text-gray-500">
          Long range picked - showing the last {MAX_HEATMAP_DAYS} days hour by hour.
        </p>
      )}
      <div className="flex gap-4">
        <div className="flex-1 overflow-x-auto">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `44px repeat(${dateLabels.length}, minmax(10px, 1fr))`,
              gap: "2px",
              minWidth: dateLabels.length > 14 ? `${44 + dateLabels.length * 12}px` : undefined,
            }}
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
                        ? `${dateLabels[d]}, ${hourLabels[h]} - No Data`
                        : `${dateLabels[d]}, ${hourLabels[h]} - ${v.toFixed(1)} kWh`
                    }
                    className="h-3.5 rounded-[3px]"
                    style={{ background: colorFor(v, maxValue) }}
                  />
                ))}
              </Fragment>
            ))}

            <div />
            {dateLabels.map((dl, d) => (
              <div key={dl} className="whitespace-nowrap pt-1.5 text-center text-[10px] text-gray-400">
                {d % labelStep === 0 ? dl : ""}
              </div>
            ))}
          </div>
        </div>

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
