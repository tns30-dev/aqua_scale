import { clsx } from "clsx";
import { fmtRange } from "./format";
import type { FeedingCycleInfo, FeedingKpiChanges, FeedingKpis } from "./types";

interface KpiCardsProps {
  kpis: {
    base: FeedingKpis;
    compare: FeedingKpis | null;
    changes: FeedingKpiChanges | null;
  };
  base: FeedingCycleInfo;
  compare: FeedingCycleInfo | null;
  horizonDays: number;
  baseLabel: string;
  cmpLabel: string;
  color: string;
  cmpColor: string;
}

function DeltaChip({
  value,
  betterWhen,
  digits = 1,
  suffix = "%",
}: {
  value: number;
  betterWhen: "low" | "high";
  digits?: number;
  suffix?: string;
}) {
  const good = betterWhen === "low" ? value < 0 : value > 0;
  return (
    <span
      className={clsx(
        "ml-2 inline-block rounded-full px-1.5 py-px align-middle text-[10px] font-bold",
        value === 0 ? "bg-gray-100 text-gray-500" : good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
      )}
    >
      {value >= 0 ? "+" : ""}
      {value.toFixed(digits)}
      {suffix}
    </span>
  );
}

function Kpi({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">
        {value}
        {unit && <span className="ml-1 text-xs font-semibold text-gray-500">{unit}</span>}
      </p>
      {sub && <p className="mt-1 text-[11px] text-gray-500">{sub}</p>}
    </div>
  );
}

function PanelKpi({
  label,
  value,
  unit,
  chip,
  span,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  chip?: React.ReactNode;
  span: "half" | "third";
}) {
  return (
    <div className={clsx("rounded-xl border border-gray-200 bg-white p-3", span === "half" ? "col-span-3" : "col-span-2")}>
      <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900">
        {value}
        {unit && <span className="ml-1 text-[11px] font-semibold text-gray-500">{unit}</span>}
        {chip}
      </p>
    </div>
  );
}

function CyclePanel({
  label,
  sub,
  color,
  k,
  changes,
}: {
  label: string;
  sub: string;
  color: string;
  k: FeedingKpis;
  changes?: FeedingKpiChanges | null;
}) {
  return (
    <div className="space-y-2.5 rounded-xl border-2 bg-white p-3" style={{ borderColor: color }}>
      <div
        className="rounded-lg border p-3"
        style={{ backgroundColor: `${color}10`, borderColor: `${color}30`, borderLeftWidth: 3, borderLeftColor: color }}
      >
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
          {label}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-gray-500">{sub}</p>
      </div>
      <div className="grid grid-cols-6 gap-2.5">
        <PanelKpi
          label="Cycle Feed"
          value={k.feedKg}
          unit="kg"
          chip={changes?.feedPct != null && <DeltaChip value={changes.feedPct} betterWhen="low" />}
          span="half"
        />
        <PanelKpi
          label="Feed Cost"
          value={`S$ ${k.cost.toLocaleString()}`}
          chip={changes?.costPct != null && <DeltaChip value={changes.costPct} betterWhen="low" />}
          span="half"
        />
        <PanelKpi
          label="Avg Daily Feed"
          value={k.avgKgPerDay}
          unit="kg/day"
          chip={changes?.avgPct != null && <DeltaChip value={changes.avgPct} betterWhen="low" />}
          span="third"
        />
        <PanelKpi
          label="FCR"
          value={k.fcr != null ? k.fcr.toFixed(2) : "—"}
          chip={changes?.fcrDiff != null && <DeltaChip value={changes.fcrDiff} betterWhen="low" digits={2} suffix="" />}
          span="third"
        />
        <PanelKpi
          label="Biomass Gain"
          value={k.biomassGainKg != null ? k.biomassGainKg : "—"}
          unit={k.biomassGainKg != null ? "kg" : undefined}
          chip={changes?.gainPct != null && <DeltaChip value={changes.gainPct} betterWhen="high" />}
          span="third"
        />
      </div>
    </div>
  );
}

export function KpiCards({ kpis, base, compare, horizonDays, baseLabel, cmpLabel, color, cmpColor }: KpiCardsProps) {
  if (kpis.compare && compare) {
    const cmpLen = compare.elapsedDays;
    return (
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <CyclePanel
          label={baseLabel}
          sub={`${fmtRange(base.startDate, base.endDate)} · compared over first ${horizonDays} days`}
          color={color}
          k={kpis.base}
          changes={kpis.changes}
        />
        <CyclePanel
          label={cmpLabel}
          sub={`${fmtRange(compare.startDate, compare.endDate)} · ${
            compare.endDate ? `finished, ${cmpLen} days` : `ongoing, day ${cmpLen}`
          }`}
          color={cmpColor}
          k={kpis.compare}
        />
      </div>
    );
  }

  const k = kpis.base;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Kpi label="Cycle Feed" value={k.feedKg} unit="kg" sub="All feed given this cycle" />
      <Kpi label="Feed Cost" value={`S$ ${k.cost.toLocaleString()}`} sub="From your configured feed prices" />
      <Kpi label="Avg Daily Feed" value={k.avgKgPerDay} unit="kg/day" sub="Cycle feed ÷ days so far" />
      <Kpi
        label="FCR"
        value={k.fcr != null ? k.fcr.toFixed(2) : "—"}
        sub={
          k.fcr != null
            ? "Feed per kg gained · lower is better"
            : "Feed per kg gained · shown at harvest"
        }
      />
      <Kpi
        label="Biomass Gain"
        value={k.biomassGainKg != null ? k.biomassGainKg : "—"}
        unit={k.biomassGainKg != null ? "kg" : undefined}
        sub={
          k.biomassGainKg != null
            ? `${base.stockingBiomassKg} → ${base.harvestBiomassKg} kg`
            : "Weight gained over the cycle · shown at harvest"
        }
      />
    </div>
  );
}
