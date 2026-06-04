import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import { EnergyCard } from "./EnergyCard";
import type { TrendPoint } from "./types";

interface Props {
  data: TrendPoint[];
  currentLabel: string;
  previousLabel: string;
}

function TrendTooltip({ active, payload, label }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-gray-900">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-gray-600">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.dataKey === "current" ? "#059669" : "#9ca3af" }}
          />
          {p.dataKey === "current" ? "Current" : "Previous"}: {Number(p.value).toFixed(1)} kWh
        </p>
      ))}
    </div>
  );
}

/** Consumption trend — current period as bars, previous period as a dashed line. */
export function ConsumptionTrendChart({ data, currentLabel, previousLabel }: Props) {
  return (
    <EnergyCard
      title="Consumption Trend (kWh)"
      action={
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-3 rounded-sm bg-emerald-600" />
            {currentLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t-2 border-dashed border-gray-400" />
            {previousLabel}
          </span>
        </div>
      }
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} width={40} />
            <Tooltip content={<TrendTooltip />} cursor={{ fill: "#f8fafc" }} />
            <Bar dataKey="current" fill="#059669" radius={[4, 4, 0, 0]} barSize={28} />
            <Line
              type="monotone"
              dataKey="previous"
              stroke="#9ca3af"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: "#9ca3af" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </EnergyCard>
  );
}
