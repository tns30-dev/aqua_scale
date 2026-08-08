import type { ComponentType } from "react";
import { Activity, ArrowDown, ArrowUp, Clock, DollarSign, TrendingUp, Zap } from "lucide-react";
import { clsx } from "clsx";
import type { EnergyKpis } from "./types";

interface KpiCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit?: string;
  footer: React.ReactNode;
}

function KpiCard({ icon: Icon, label, value, unit, footer }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50">
          <Icon className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900">{value}</span>
            {unit && <span className="text-sm text-gray-400">{unit}</span>}
          </p>
        </div>
      </div>
      <div className="mt-3 text-xs">{footer}</div>
    </div>
  );
}

function Change({ pct, suffix }: { pct: number | null; suffix?: string }) {
  if (pct === null) {
    return <span className="text-gray-400">No earlier period to compare</span>;
  }
  const down = pct < 0;
  const Arrow = down ? ArrowDown : ArrowUp;
  return (
    <span className="flex items-center gap-1 text-gray-400">
      <span className={clsx("flex items-center gap-0.5 font-semibold", down ? "text-emerald-600" : "text-red-500")}>
        <Arrow className="h-3 w-3" />
        {Math.abs(pct)}%
      </span>
      {suffix}
    </span>
  );
}

function Previous({ value }: { value: string }) {
  return <span className="block text-gray-400">Previous: {value}</span>;
}

export function KpiCards({ kpis, showCompare }: { kpis: EnergyKpis; showCompare: boolean }) {
  const vs = `vs ${kpis.compareLabel}`;
  const costDown = kpis.costChange < 0;
  const CostArrow = costDown ? ArrowDown : ArrowUp;
  const change = (previous: string) =>
    showCompare ? (
      <div className="space-y-1">
        <Change pct={kpis.changeVsPreviousPct} suffix={vs} />
        <Previous value={previous} />
      </div>
    ) : null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard
        icon={Zap}
        label="Total Electricity (kWh)"
        value={kpis.totalKwh.toFixed(1)}
        unit="kWh"
        footer={change(`${kpis.previousTotalKwh.toFixed(1)} kWh`)}
      />
      <KpiCard
        icon={DollarSign}
        label="Estimated Cost"
        value={`${kpis.currencySymbol}${kpis.estimatedCost.toFixed(2)}`}
        footer={
          <div className="space-y-1">
            {showCompare && (
              <span className="flex items-center gap-1 text-gray-400">
                <span
                  className={clsx(
                    "flex items-center gap-0.5 font-semibold",
                    costDown ? "text-emerald-600" : "text-red-500",
                  )}
                >
                  <CostArrow className="h-3 w-3" />
                  {kpis.currencySymbol}
                  {Math.abs(kpis.costChange).toFixed(2)}
                </span>
                {vs}
              </span>
            )}
            {showCompare && (
              <Previous value={`${kpis.currencySymbol}${kpis.previousEstimatedCost.toFixed(2)}`} />
            )}
            <span className="block text-gray-400">
              Based on {kpis.currencySymbol}
              {kpis.tariffPerKwh.toFixed(4)} / kWh tariff
            </span>
          </div>
        }
      />
      <KpiCard
        icon={TrendingUp}
        label="Average kWh / Day"
        value={kpis.avgKwhPerDay.toFixed(1)}
        unit="kWh"
        footer={change(`${kpis.previousAvgKwhPerDay.toFixed(1)} kWh`)}
      />
      <KpiCard
        icon={Clock}
        label="Average kWh / Hour"
        value={kpis.avgKwhPerHour.toFixed(2)}
        unit="kWh"
        footer={change(`${kpis.previousAvgKwhPerHour.toFixed(2)} kWh`)}
      />
      <KpiCard
        icon={Activity}
        label="Peak Hour (kWh)"
        value={kpis.peakHourKwh.toFixed(1)}
        unit="kWh"
        footer={
          <div className="space-y-1">
            <span className="block text-gray-400">{kpis.peakHourLabel}</span>
            {showCompare && <Previous value={`${kpis.previousPeakHourKwh.toFixed(1)} kWh`} />}
          </div>
        }
      />
    </div>
  );
}
