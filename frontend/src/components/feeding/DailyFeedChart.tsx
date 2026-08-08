import { useMemo, useState } from "react";
import { Chart } from "react-chartjs-2";
import { STAGE_STRIP_H, hexA, stageBandsPlugin } from "./stageBandsPlugin";
import { StageKeyRow } from "./StageKeyRow";
import type { CycleTemplate, FeedingDay } from "./types";

interface DailyFeedChartProps {
  template: CycleTemplate;
  days: FeedingDay[];
  cmpDays: FeedingDay[] | null;
  seriesLabel: string;
  cmpSeriesLabel?: string;
  color: string;
  cmpColor: string;
  yMax?: number;
}

export function DailyFeedChart({
  template,
  days,
  cmpDays,
  seriesLabel,
  cmpSeriesLabel,
  color,
  cmpColor,
  yMax,
}: DailyFeedChartProps) {
  const [collapsedStages, setCollapsedStages] = useState<number[]>([]);
  const { labels, dA, dB } = useMemo(() => {
    const axisLen = Math.max(template.lengthDays, days.length, cmpDays?.length ?? 0);
    return {
      labels: Array.from({ length: axisLen }, (_, i) => `D${i + 1}`),
      dA: days.map((d) => d.totalKg),
      dB: cmpDays ? cmpDays.map((d) => d.totalKg) : null,
    };
  }, [template, days, cmpDays]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2.5">
        <h3 className="text-sm font-bold text-gray-900">
          Daily Feed <span className="text-xs font-semibold text-gray-400">(kg)</span>
        </h3>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">By cycle day</p>
      </div>
      <div className="relative h-[230px]">
        <Chart
          type="bar"
          data={{
            labels,
            datasets: [
              {
                type: "bar" as const,
                label: seriesLabel,
                data: dA,
                backgroundColor: hexA(color, dB ? 0.8 : 0.55),
                borderRadius: 3,
                order: 1,
              },
              ...(dB
                ? [
                    {
                      type: "bar" as const,
                      label: cmpSeriesLabel ?? "Compared",
                      data: dB,
                      backgroundColor: hexA(cmpColor, 0.8),
                      borderRadius: 3,
                      order: 2,
                    },
                  ]
                : []),
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: STAGE_STRIP_H } },
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { maxTicksLimit: 10, font: { size: 9 }, color: "#9aa3ad" } },
              y: { suggestedMax: yMax, grid: { color: "#eef1f4" }, ticks: { font: { size: 9 }, color: "#9aa3ad" } },
            },
          }}
          plugins={[stageBandsPlugin(template, setCollapsedStages)]}
        />
      </div>
      <StageKeyRow template={template} collapsed={collapsedStages} />
      {dB && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-100 pt-2.5 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: hexA(color, 0.8) }} />
            <span className="font-semibold text-gray-700">{seriesLabel}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: hexA(cmpColor, 0.8) }} />
            <span className="font-semibold text-gray-700">{cmpSeriesLabel ?? "Compared"}</span>
          </span>
        </div>
      )}
    </div>
  );
}
