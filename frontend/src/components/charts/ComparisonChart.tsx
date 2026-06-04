import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { TooltipProps } from "recharts";
import type {
  ValueType,
  NameType,
} from "recharts/types/component/DefaultTooltipContent";

// Types
export interface ComparisonChartDataPoint {
  label: string;
  seriesA: number;
  /**
   * Optional. Omit (or pass undefined) for single-series charts —
   * Recharts renders nothing for that series at that point, and the legend +
   * tooltip already skip Pond B when seriesBLabel is empty.
   */
  seriesB?: number;
}

interface ComparisonChartTooltipProps {
  seriesALabel: string;
  seriesBLabel: string;
  themeColor: string;
}

export interface ComparisonChartProps {
  /** Chart display mode */
  variant: "line" | "bar";

  /** Chart title shown in card header (e.g., "Ammonium (NH4+)") */
  title: string;

  /** Badge text shown top-right (e.g., "WEEKLY", "DAILY") */
  badge?: string;

  /** Data array — one object per x-axis tick */
  data: ComparisonChartDataPoint[];

  /** Display name for series A (e.g., "Pond Alpha-01") */
  seriesALabel: string;

  /** Display name for series B (e.g., "Pond Delta-04") */
  seriesBLabel: string;

  /** Profile theme color — drives border, badge tint. Default: #1e40af */
  themeColor?: string;

  /** Pond A line/bar color — defaults to themeColor */
  colorA?: string;

  /** Pond B line/bar color — defaults to themeColor at 55% opacity */
  colorB?: string;

  /** Chart height in px — default: 180 */
  height?: number;

  /** Show loading spinner */
  isLoading?: boolean;
}

// Constants
const DEFAULT_THEME_COLOR = "#1e40af";
// Series B color derived from theme — will be set per-instance
const DEFAULT_HEIGHT = 180;
const AXIS_TICK_COLOR = "#9CA3AF";
const AXIS_STROKE_COLOR = "#E5E7EB";

// Sub-components
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
      No data available
    </div>
  );
}

function ChartLegend({
  seriesALabel,
  seriesBLabel,
  themeColor,
  seriesBColor,
  variant,
}: {
  seriesALabel: string;
  seriesBLabel: string;
  themeColor: string;
  seriesBColor: string;
  variant: "line" | "bar";
}) {
  const Indicator = variant === "bar" ? BarIndicator : LineIndicator;
  return (
    <div className="flex gap-4 pt-2 text-[10px] text-gray-500">
      <span className="flex items-center gap-1">
        <Indicator color={themeColor} />
        {seriesALabel}
      </span>
      {seriesBLabel && (
        <span className="flex items-center gap-1">
          <Indicator color={seriesBColor} />
          {seriesBLabel}
        </span>
      )}
    </div>
  );
}

function LineIndicator({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-[3px] w-3 rounded-sm"
      style={{ background: color }}
    />
  );
}

function BarIndicator({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-[7px] w-3 rounded-sm"
      style={{ background: color, opacity: 0.7 }}
    />
  );
}

// Custom tooltip content
function CustomTooltip({
  active,
  payload,
  label,
  seriesALabel,
  seriesBLabel,
  themeColor,
}: TooltipProps<ValueType, NameType> & ComparisonChartTooltipProps) {
  if (!active || !payload || payload.length < 2) return null;

  const valA = payload.find((p) => p.dataKey === "seriesA")?.value;
  const valB = payload.find((p) => p.dataKey === "seriesB")?.value;

  const formatValue = (val: ValueType | undefined) =>
    typeof val === "number" ? val.toFixed(2) : String(val ?? "--");

  return (
    <div className="min-w-[160px] rounded-lg bg-gray-800 px-3 py-2.5">
      <p className="mb-1.5 text-[11px] text-gray-400">{label}</p>
      <p className="my-0.5 text-xs" style={{ color: themeColor }}>
        {seriesALabel}:{" "}
        <span className="font-semibold text-gray-50">{formatValue(valA)}</span>
      </p>
      <p className="my-0.5 text-xs text-gray-400">
        {seriesBLabel}:{" "}
        <span className="font-semibold text-gray-50">{formatValue(valB)}</span>
      </p>
    </div>
  );
}

// Main component
export const ComparisonChart = React.memo(function ComparisonChart({
  variant,
  title,
  badge,
  data,
  seriesALabel,
  seriesBLabel,
  themeColor = DEFAULT_THEME_COLOR,
  colorA,
  colorB,
  height = DEFAULT_HEIGHT,
  isLoading = false,
}: ComparisonChartProps) {
  const hasData = data && Array.isArray(data) && data.length > 0;
  const seriesAColor = colorA || themeColor;
  const seriesBColor = colorB || `${themeColor}55`;

  // Shared axis props
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

  const tooltipElement = (
    <Tooltip
      content={
        <CustomTooltip
          seriesALabel={seriesALabel}
          seriesBLabel={seriesBLabel}
          themeColor={themeColor}
        />
      }
      cursor={
        variant === "bar"
          ? { fill: "rgba(0,0,0,0.04)" }
          : { stroke: AXIS_STROKE_COLOR }
      }
    />
  );

  // Render component
  return (
    <div className="rounded-[10px] border border-gray-200 bg-white px-4 py-3.5">
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-gray-500">{title}</span>
        {badge && (
          <span
            className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
            style={{ color: themeColor }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Chart area */}
      {isLoading && <LoadingSpinner height={height} />}

      {!isLoading && !hasData && <EmptyState height={height} />}

      {!isLoading && hasData && variant === "line" && (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            {tooltipElement}
            <Line
              type="monotone"
              dataKey="seriesA"
              name={seriesALabel}
              stroke={seriesAColor}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="seriesB"
              name={seriesBLabel}
              stroke={seriesBColor}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {!isLoading && hasData && variant === "bar" && (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} barCategoryGap="20%">
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            {tooltipElement}
            <Bar
              dataKey="seriesB"
              name={seriesBLabel}
              fill={seriesBColor}
              fillOpacity={0.45}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="seriesA"
              name={seriesALabel}
              fill={seriesAColor}
              fillOpacity={0.6}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      {hasData && !isLoading && (
        <ChartLegend
          seriesALabel={seriesALabel}
          seriesBLabel={seriesBLabel}
          themeColor={seriesAColor}
          seriesBColor={seriesBColor}
          variant={variant}
        />
      )}
    </div>
  );
});
