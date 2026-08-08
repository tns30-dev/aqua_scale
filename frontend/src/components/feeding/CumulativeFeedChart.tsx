import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Chart } from "react-chartjs-2";
import { endLabelsPlugin } from "./endLabelsPlugin";
import { fmtRange } from "./format";
import { STAGE_STRIP_H, stageBandsPlugin } from "./stageBandsPlugin";
import { StageKeyRow } from "./StageKeyRow";
import {
  type DecoratedTreatment,
  treatmentDayRange,
  treatmentMarksPlugin,
} from "./treatmentMarksPlugin";
import type { CycleTemplate, FeedingDay } from "./types";

interface CumulativeFeedChartProps {
  template: CycleTemplate;
  days: FeedingDay[];
  cmpDays: FeedingDay[] | null;
  seriesLabel: string;
  cmpSeriesLabel?: string;
  color: string;
  cmpColor: string;
  yMax?: number;
  treatments?: DecoratedTreatment[];
}

// The running total exists only while there is data: days past the last
// recorded entry are null, so the line STOPS instead of drawing a flat
// plateau across stages that have not happened yet.
function cumulative(days: FeedingDay[]): (number | null)[] {
  let last = -1;
  days.forEach((d, i) => {
    if (d.entries.length > 0) last = i;
  });
  let sum = 0;
  return days.map((d, i) => (i <= last ? Math.round((sum += d.totalKg) * 10) / 10 : null));
}

function TreatmentItem({ t }: { t: DecoratedTreatment }) {
  return (
    <span
      className="flex items-center gap-1.5"
      title={`${fmtRange(t.startDate, t.endDate)}${t.notes ? ` · ${t.notes}` : ""}`}
    >
      <svg width="8" height="14" aria-hidden="true" className="shrink-0">
        <line x1="4" y1="1" x2="4" y2="13" stroke={t.color} strokeWidth="2" strokeDasharray="2 2.5" strokeLinecap="round" />
      </svg>
      <span className="font-semibold text-gray-700">{t.name}</span>
      <span className="text-gray-400">{treatmentDayRange(t)}</span>
    </span>
  );
}

function SeriesItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="18" height="6" aria-hidden="true" className="shrink-0">
        <line x1="1" y1="3" x2="17" y2="3" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="font-semibold text-gray-700">{label}</span>
    </span>
  );
}

export function CumulativeFeedChart({
  template,
  days,
  cmpDays,
  seriesLabel,
  cmpSeriesLabel,
  color,
  cmpColor,
  yMax,
  treatments,
}: CumulativeFeedChartProps) {
  const { labels, cA, cB } = useMemo(() => {
    const axisLen = Math.max(template.lengthDays, days.length, cmpDays?.length ?? 0);
    return {
      labels: Array.from({ length: axisLen }, (_, i) => `D${i + 1}`),
      cA: cumulative(days),
      cB: cmpDays ? cumulative(cmpDays) : null,
    };
  }, [template, days, cmpDays]);

  const [showTreatments, setShowTreatments] = useState(false);
  const [collapsedStages, setCollapsedStages] = useState<number[]>([]);
  // Two cycles in ONE plot can carry up to a dozen dotted verticals — an
  // unreadable forest (owner, 23 Jul 2026). The stacked comparison view
  // does not facilitate treatments at all: no marks, no eye toggle, no
  // treatment legend rows. Solo and side-by-side keep the full overlay.
  const comparing = cmpDays != null;
  const decorated = comparing ? [] : treatments ?? [];
  const hasTreatments = decorated.length > 0;
  const allMarks = useMemo(
    () => (showTreatments ? decorated : []),
    [decorated, showTreatments],
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">
            Cumulative Feed <span className="text-xs font-semibold text-gray-400">(kg)</span>
          </h3>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">By cycle day</p>
        </div>
        {hasTreatments && (
          <button
            type="button"
            onClick={() => setShowTreatments((v) => !v)}
            aria-pressed={showTreatments}
            className={
              showTreatments
                ? "flex items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 px-2 py-1 text-[10px] font-bold text-gray-700 hover:bg-gray-100"
                : "flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-400 hover:border-gray-300 hover:text-gray-600"
            }
          >
            {showTreatments ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            Treatments
          </button>
        )}
      </div>
      <div className="relative h-[230px]">
        <Chart
          type="line"
          data={{
            labels,
            datasets: [
              {
                label: seriesLabel,
                data: cA,
                borderColor: color,
                borderWidth: 2,
                fill: false,
                tension: 0.3,
                pointRadius: 0,
              },
              ...(cB
                ? [
                    {
                      label: cmpSeriesLabel ?? "Compared",
                      data: cB,
                      borderColor: cmpColor,
                      borderWidth: 2,
                      fill: false,
                      tension: 0.3,
                      pointRadius: 0,
                    },
                  ]
                : []),
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            layout: { padding: { right: 58, top: STAGE_STRIP_H } },
            plugins: { legend: { display: false }, treatmentMarks: { items: allMarks } },
            scales: {
              x: { grid: { display: false }, ticks: { maxTicksLimit: 10, font: { size: 9 }, color: "#9aa3ad" } },
              y: { suggestedMax: yMax, grid: { color: "#eef1f4" }, ticks: { font: { size: 9 }, color: "#9aa3ad" } },
            },
          }}
          plugins={[stageBandsPlugin(template, setCollapsedStages), endLabelsPlugin(), treatmentMarksPlugin]}
        />
      </div>
      <StageKeyRow template={template} collapsed={collapsedStages} />
      {cB != null ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-100 pt-2.5 text-[11px]">
          <SeriesItem color={color} label={seriesLabel} />
          <SeriesItem color={cmpColor} label={cmpSeriesLabel ?? "Compared"} />
        </div>
      ) : (
        showTreatments &&
        decorated.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-100 pt-2.5 text-[11px]">
            {decorated.map((t) => (
              <TreatmentItem key={t.pondTreatmentId} t={t} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
