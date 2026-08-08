import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Line,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { TooltipProps } from "recharts";
import type {
  ValueType,
  NameType,
} from "recharts/types/component/DefaultTooltipContent";

export interface ComparisonChartDataPoint {
  label: string;
  seriesA?: number | null;
  seriesB?: number | null;
}

interface ComparisonChartTooltipProps {
  seriesALabel: string;
  seriesBLabel: string;
  themeColor: string;
}

export interface ComparisonChartProps {
  variant: "line" | "bar";
  title: string;
  unit?: string;
  watchedBy?: string[];
  badge?: string;
  data: ComparisonChartDataPoint[];
  seriesALabel: string;
  seriesBLabel: string;
  seriesANoReadings?: boolean;
  seriesBNoReadings?: boolean;
  themeColor?: string;
  colorA?: string;
  colorB?: string;
  height?: number;
  isLoading?: boolean;
}

const DEFAULT_THEME_COLOR = "#1e40af";
const DEFAULT_HEIGHT = 180;
const AXIS_TICK_COLOR = "#9CA3AF";
const AXIS_STROKE_COLOR = "#E5E7EB";
const GRID_COLOR = "#f1f5f9";

function LoadingSpinner({ height }: { height: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
    </div>
  );
}

function EmptyState({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-gray-400"
      style={{ height }}
    >
      No readings for this period
    </div>
  );
}

function LineIndicator({ color, muted }: { color: string; muted?: boolean }) {
  return (
    <span
      className="inline-block h-[3px] w-3 rounded-sm"
      style={{ background: color, opacity: muted ? 0.3 : 1 }}
    />
  );
}

function BarIndicator({ color, muted }: { color: string; muted?: boolean }) {
  return (
    <span
      className="inline-block h-[7px] w-3 rounded-sm"
      style={{ background: color, opacity: muted ? 0.3 : 0.7 }}
    />
  );
}

function ChartLegend({
  seriesALabel,
  seriesBLabel,
  seriesANoReadings,
  seriesBNoReadings,
  themeColor,
  seriesBColor,
  variant,
}: {
  seriesALabel: string;
  seriesBLabel: string;
  seriesANoReadings: boolean;
  seriesBNoReadings: boolean;
  themeColor: string;
  seriesBColor: string;
  variant: "line" | "bar";
}) {
  const Indicator = variant === "bar" ? BarIndicator : LineIndicator;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-100 pt-2.5 text-[11px] text-gray-500">
      <span className={`flex items-center gap-1 ${seriesANoReadings ? "text-gray-400" : ""}`}>
        <Indicator color={themeColor} muted={seriesANoReadings} />
        {seriesALabel}
        {seriesANoReadings && " - no readings this period"}
      </span>
      {seriesBLabel && (
        <span className={`flex items-center gap-1 ${seriesBNoReadings ? "text-gray-400" : ""}`}>
          <Indicator color={seriesBColor} muted={seriesBNoReadings} />
          {seriesBLabel}
          {seriesBNoReadings && " - no readings this period"}
        </span>
      )}
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  seriesALabel,
  seriesBLabel,
  themeColor,
}: TooltipProps<ValueType, NameType> & ComparisonChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const valA = payload.find((p) => p.dataKey === "seriesA")?.value;
  const valB = payload.find((p) => p.dataKey === "seriesB")?.value;

  const formatValue = (val: ValueType | undefined) =>
    typeof val === "number" ? val.toFixed(2) : String(val ?? "--");

  return (
    <div className="min-w-[160px] rounded-lg bg-gray-800 px-3 py-2.5">
      <p className="mb-1.5 text-[11px] text-gray-400">{label}</p>
      {seriesALabel && valA !== undefined && (
        <p className="my-0.5 text-xs" style={{ color: themeColor }}>
          {seriesALabel}:{" "}
          <span className="font-semibold text-gray-50">{formatValue(valA)}</span>
        </p>
      )}
      {seriesBLabel && valB !== undefined && (
        <p className="my-0.5 text-xs text-gray-400">
          {seriesBLabel}:{" "}
          <span className="font-semibold text-gray-50">{formatValue(valB)}</span>
        </p>
      )}
    </div>
  );
}

export const ComparisonChart = React.memo(function ComparisonChart({
  variant,
  title,
  unit,
  watchedBy = [],
  badge,
  data,
  seriesALabel,
  seriesBLabel,
  seriesANoReadings = false,
  seriesBNoReadings = false,
  themeColor = DEFAULT_THEME_COLOR,
  colorA,
  colorB,
  height = DEFAULT_HEIGHT,
  isLoading = false,
}: ComparisonChartProps) {
  const hasData = data && Array.isArray(data) && data.length > 0;
  const seriesAColor = colorA || themeColor;
  const seriesBColor = colorB || `${themeColor}55`;
  const drawA = !seriesANoReadings;
  const drawB = Boolean(seriesBLabel) && !seriesBNoReadings;
  const nothingToDraw = !drawA && !drawB;

  const xAxisProps = {
    dataKey: "label" as const,
    tick: { fontSize: 10, fill: AXIS_TICK_COLOR },
    stroke: AXIS_STROKE_COLOR,
    tickLine: false,
    axisLine: false,
  };

  const yAxisProps = {
    tick: { fontSize: 10, fill: AXIS_TICK_COLOR },
    stroke: AXIS_STROKE_COLOR,
    tickLine: false,
    axisLine: false,
    width: 40,
  };

  const gridElement = (
    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
  );

  const tooltipElement = (
    <Tooltip
      content={
        <CustomTooltip
          seriesALabel={drawA ? seriesALabel : ""}
          seriesBLabel={drawB ? seriesBLabel : ""}
          themeColor={seriesAColor}
        />
      }
      cursor={
        variant === "bar"
          ? { fill: "rgba(0,0,0,0.04)" }
          : { stroke: AXIS_STROKE_COLOR }
      }
    />
  );

  const showChart = !isLoading && hasData && !nothingToDraw;

  return (
    <div className="rounded-[10px] border border-gray-200 bg-white px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-gray-900">
          {title}
          {unit && <span className="text-xs font-semibold text-gray-500">({unit})</span>}
          {watchedBy.map((name) => (
            <span
              key={name}
              className="rounded-full bg-gray-100 px-1.5 py-px text-[9px] font-semibold text-gray-600"
            >
              {name}
            </span>
          ))}
        </h3>
        {badge && (
          <span
            className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
            style={{ color: themeColor }}
          >
            {badge}
          </span>
        )}
      </div>

      {isLoading && <LoadingSpinner height={height} />}
      {!isLoading && (!hasData || nothingToDraw) && <EmptyState height={height} />}

      {showChart && variant === "line" && (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            {gridElement}
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            {tooltipElement}
            {drawA && (
              <Line
                type="monotone"
                dataKey="seriesA"
                name={seriesALabel}
                stroke={seriesAColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}
            {drawB && (
              <Line
                type="monotone"
                dataKey="seriesB"
                name={seriesBLabel}
                stroke={seriesBColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}

      {showChart && variant === "bar" && (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} barCategoryGap="20%">
            {gridElement}
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            {tooltipElement}
            {drawB && (
              <Bar
                dataKey="seriesB"
                name={seriesBLabel}
                fill={seriesBColor}
                fillOpacity={0.45}
                radius={[4, 4, 0, 0]}
              />
            )}
            {drawA && (
              <Bar
                dataKey="seriesA"
                name={seriesALabel}
                fill={seriesAColor}
                fillOpacity={0.6}
                radius={[4, 4, 0, 0]}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      )}

      {hasData && !isLoading && (
        <ChartLegend
          seriesALabel={seriesALabel}
          seriesBLabel={seriesBLabel}
          seriesANoReadings={seriesANoReadings}
          seriesBNoReadings={Boolean(seriesBLabel) && seriesBNoReadings}
          themeColor={seriesAColor}
          seriesBColor={seriesBColor}
          variant={variant}
        />
      )}
    </div>
  );
});
