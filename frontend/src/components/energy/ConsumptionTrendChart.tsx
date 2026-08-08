import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { ArrowDown, ArrowUp } from "lucide-react";
import { clsx } from "clsx";
import { EnergyCard } from "./EnergyCard";
import type { CompareInfo, TrendPoint } from "./types";

interface Props {
  data: TrendPoint[];
  currentLabel: string;
  previousLabel: string;
  showPrevious: boolean;
  compareInfo: CompareInfo;
}

function TrendTooltip({
  active,
  payload,
  label,
  showPrevious,
}: TooltipProps<ValueType, NameType> & { showPrevious?: boolean }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as TrendPoint;
  const pct =
    showPrevious && point.previous !== null && point.previous > 0
      ? ((point.current - point.previous) / point.previous) * 100
      : null;
  const down = (pct ?? 0) < 0;
  const DeltaArrow = down ? ArrowDown : ArrowUp;

  const row = (isCurrent: boolean) => {
    const when = isCurrent ? (point.currentLabel ?? label) : point.previousLabel;
    const value = isCurrent ? point.current : point.previous;
    return (
      <div className="flex items-center justify-between gap-5">
        <span className="flex items-center gap-2">
          {isCurrent ? (
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-emerald-600" />
          ) : (
            <span className="h-0 w-2.5 shrink-0 border-t-2 border-dashed border-gray-400" />
          )}
          <span>
            <span className="block text-xs font-semibold text-gray-900">
              {isCurrent ? "Current" : "Previous"}
            </span>
            {when && <span className="block text-[10px] text-gray-400">{when}</span>}
          </span>
        </span>
        {value !== null ? (
          <span className="text-sm font-bold text-gray-900">
            {value.toFixed(1)}
            <span className="ml-1 text-[10px] font-medium text-gray-400">kWh</span>
          </span>
        ) : (
          <span className="text-xs font-medium text-gray-400">No Data</span>
        )}
      </div>
    );
  };

  return (
    <div className="min-w-[185px] rounded-xl border border-gray-100 bg-white/95 px-3.5 py-3 shadow-lg backdrop-blur">
      <div className="space-y-2.5">
        {row(true)}
        {showPrevious && row(false)}
      </div>
      {pct !== null && (
        <div className="mt-2.5 flex items-center gap-1 border-t border-gray-100 pt-2 text-[11px]">
          <span
            className={clsx(
              "flex items-center gap-0.5 font-semibold",
              down ? "text-emerald-600" : "text-red-500",
            )}
          >
            <DeltaArrow className="h-3 w-3" />
            {Math.abs(pct).toFixed(1)}%
          </span>
          <span className="text-gray-400">vs previous</span>
        </div>
      )}
    </div>
  );
}

export function ConsumptionTrendChart({
  data,
  currentLabel,
  previousLabel,
  showPrevious,
  compareInfo,
}: Props) {
  const scrolling = data.length > 16;
  const longestLabel = data.reduce((m, p) => Math.max(m, p.label.length), 0);
  const pointWidth = Math.max(44, longestLabel * 7 + 12);

  return (
    <EnergyCard
      title="Consumption Trend (kWh)"
      info="Electricity over time for the selected range and Group By. The dashed line is the previous period of the same duration."
      action={
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-3 rounded-sm bg-emerald-600" />
            {currentLabel}
          </span>
          {showPrevious && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0 w-4 border-t-2 border-dashed border-gray-400" />
              {previousLabel}
            </span>
          )}
        </div>
      }
    >
      <div className="overflow-x-auto">
        <div
          className="h-72"
          style={{ minWidth: scrolling ? `${data.length * pointWidth + 48}px` : undefined }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                interval={scrolling ? 0 : undefined}
                minTickGap={scrolling ? undefined : 24}
              />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} width={40} />
              <Tooltip content={<TrendTooltip showPrevious={showPrevious} />} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="current" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={28} />
              {showPrevious && (
                <Line
                  type="monotone"
                  dataKey="previous"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: "#9ca3af" }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
          <span className="h-2 w-2 rounded-sm bg-emerald-600" />
          Current · {compareInfo.currentRange}
        </span>
        {showPrevious && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
            <span className="h-0 w-3 border-t-2 border-dashed border-gray-400" />
            Previous · {compareInfo.previousRange}
          </span>
        )}
      </div>
    </EnergyCard>
  );
}
