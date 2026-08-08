import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { clsx } from "clsx";
import { fmtD } from "./format";
import { StageDayGrid, type GridDay } from "./StageDayGrid";
import type {
  CycleTemplate,
  FeedingCycleInfo,
  FeedingDay,
  FeedingStageSummary,
} from "./types";

interface FeedDayGridProps {
  template: CycleTemplate;
  cycle: FeedingCycleInfo;
  days: FeedingDay[];
  stageSummaries: FeedingStageSummary[];
  selectedStage: number;
  onSelectStage: (index: number) => void;
  color: string;
  title?: string;
  subtitle?: string;
}

const MISSING_COLOR = "#F59E0B";
const FUTURE_COLOR = "#9CA3AF";

function SummaryChip({ value }: { value: number }) {
  return (
    <span
      className={clsx(
        "ml-1.5 inline-block rounded-full px-1.5 py-px text-[10px] font-bold",
        value === 0 ? "bg-gray-100 text-gray-500" : value < 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
      )}
    >
      {value >= 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

export function FeedDayGrid({
  template,
  cycle,
  days,
  stageSummaries,
  selectedStage,
  onSelectStage,
  color,
  title,
  subtitle,
}: FeedDayGridProps) {
  // Tap-to-toggle for the breakdown cards (mobile has no hover);
  // a tap anywhere else closes the open card.
  const [openBreakdown, setOpenBreakdown] = useState<"feed" | "cost" | null>(null);

  useEffect(() => {
    if (!openBreakdown) return;
    const close = () => setOpenBreakdown(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openBreakdown]);

  const elapsed = cycle.elapsedDays;
  const ongoing = !cycle.endDate;

  const gridDays: GridDay[] = days.map((d) => {
    const isFuture = d.day > elapsed;
    return {
      day: d.day,
      color: isFuture ? FUTURE_COLOR : d.totalKg > 0 ? color : MISSING_COLOR,
      faded: isFuture,
      clickable: false,
      isToday: ongoing && d.day === elapsed,
      marker: d.day === 1 ? "STOCKING" : !ongoing && d.day === elapsed ? "HARVEST" : undefined,
    };
  });

  const stageIndicators = template.stages.map((stage, index) => {
    if (stage.startDay > elapsed) return null;
    const missed = stageSummaries[index]?.missedDays ?? 0;
    if (missed > 0) {
      return (
        <span
          title={`${missed} day${missed === 1 ? "" : "s"} with no feeding recorded`}
          className="rounded-full bg-amber-100 px-1.5 font-bold text-amber-700"
        >
          {missed} missed
        </span>
      );
    }
    if (stage.endDay <= elapsed) {
      return <Check className="h-3 w-3 text-emerald-600" aria-label="All days fed" />;
    }
    return null;
  });

  // The hover/tap day panel replaced the old one-line summary once the
  // day-modal was retired: it now carries the full story of the day —
  // each feed type with its kg and cost, plus the day's totals.
  const money = (v: number) =>
    `S$ ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const infoFor = (dayNumber: number) => {
    const d = days.find((x) => x.day === dayNumber);
    if (!d) return null;
    if (d.day > elapsed) {
      return <p className="text-center">Day {d.day} · Upcoming (not reached yet)</p>;
    }
    if (!d.entries.length) {
      return (
        <p className="text-center">
          <span className="font-semibold">Day {d.day}</span>
          <span className="mx-1 text-gray-400">·</span>
          <span className="font-semibold text-amber-600">No feeding recorded</span>
          <span className="mx-1 text-gray-400">·</span>
          <span className="text-gray-400">{fmtD(d.date)}</span>
        </p>
      );
    }
    return (
      <div className="mx-auto w-full max-w-md">
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-bold text-gray-900">Day {d.day}</span>
          <span className="text-gray-400">· {fmtD(d.date)}</span>
          <span className="text-gray-400">
            · {d.entries.length} feeding{d.entries.length === 1 ? "" : "s"}
          </span>
        </p>
        <div className="mt-1.5 space-y-1">
          {d.entries.map((e) => (
            <div key={e.feedLogId} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="text-gray-600">
                {e.feedTypeName}
                {e.fedTime && <span className="ml-1.5 font-mono text-[10px] font-semibold text-gray-400">{e.fedTime}</span>}
              </span>
              <span className="flex gap-4 tabular-nums">
                <span className="w-16 text-right font-semibold text-gray-900">{e.amountKg} kg</span>
                <span className="w-20 text-right text-gray-500">{money(e.cost)}</span>
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-1 text-[11px] font-bold text-gray-900">
            <span>Total</span>
            <span className="flex gap-4 tabular-nums">
              <span className="w-16 text-right">{d.totalKg} kg</span>
              <span className="w-20 text-right">{money(d.cost)}</span>
            </span>
          </div>
        </div>
      </div>
    );
  };

  const summaryData = stageSummaries[selectedStage];
  const stageRange = template.stages[selectedStage];
  const stageTypeTotals = (() => {
    if (!stageRange) return [];
    const lastDay = Math.min(stageRange.endDay, elapsed);
    const totals = new Map<string, { kg: number; cost: number }>();
    days.forEach((d) => {
      if (d.day < stageRange.startDay || d.day > lastDay) return;
      d.entries.forEach((e) => {
        const t = totals.get(e.feedTypeName) ?? { kg: 0, cost: 0 };
        t.kg += e.amountKg;
        t.cost += e.cost;
        totals.set(e.feedTypeName, t);
      });
    });
    return [...totals.entries()]
      .map(([name, t]) => ({
        name,
        kg: Math.round(t.kg * 10) / 10,
        cost: Math.round(t.cost * 100) / 100,
      }))
      .sort((a, b) => b.kg - a.kg || a.name.localeCompare(b.name));
  })();

  const breakdownCard = (kind: "feed" | "cost") => (
    <span
      className={clsx(
        "pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-max -translate-x-1/2 flex-col gap-0.5 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg",
        openBreakdown === kind ? "flex" : "hidden group-hover:flex",
      )}
    >
      {stageTypeTotals.map((t) => (
        <span key={t.name} className="flex items-center justify-between gap-4 text-[11px]">
          <span className="text-gray-500">{t.name}</span>
          <span className="font-semibold tabular-nums text-gray-900">
            {kind === "feed" ? `${t.kg} kg` : `S$ ${t.cost.toLocaleString()}`}
          </span>
        </span>
      ))}
    </span>
  );

  // The stage stats are the important read of this card (owner/consultant:
  // they looked minor before) — promoted to display-size type.
  const summary = (
    <div className="rounded-lg bg-white/80 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
        {[
          { label: "Fed", dot: color },
          { label: "Missed", dot: MISSING_COLOR },
          { label: "Upcoming", dot: FUTURE_COLOR },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.dot }} />
            {l.label}
          </span>
        ))}
      </div>
      {summaryData && summaryData.feedKg != null ? (
        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-gray-100 pt-2.5">
          <button
            type="button"
            className={clsx("relative text-left", stageTypeTotals.length > 0 && "group cursor-help")}
            onClick={(e) => {
              e.stopPropagation();
              setOpenBreakdown((prev) => (prev === "feed" ? null : "feed"));
            }}
          >
            <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-500">Stage feed</span>
            <span
              className={clsx(
                "text-lg font-extrabold tracking-tight text-gray-900 tabular-nums",
                stageTypeTotals.length > 0 && "underline decoration-gray-300 decoration-dotted underline-offset-4",
              )}
            >
              {summaryData.feedKg}
              <span className="ml-1 text-[10px] font-semibold text-gray-500">kg</span>
            </span>
            {summaryData.changePct != null && <SummaryChip value={summaryData.changePct} />}
            {stageTypeTotals.length > 0 && breakdownCard("feed")}
          </button>
          <button
            type="button"
            className={clsx("relative text-left", stageTypeTotals.length > 0 && "group cursor-help")}
            onClick={(e) => {
              e.stopPropagation();
              setOpenBreakdown((prev) => (prev === "cost" ? null : "cost"));
            }}
          >
            <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-500">Cost</span>
            <span
              className={clsx(
                "text-lg font-extrabold tracking-tight text-gray-900 tabular-nums",
                stageTypeTotals.length > 0 && "underline decoration-gray-300 decoration-dotted underline-offset-4",
              )}
            >
              <span className="mr-1 text-[10px] font-semibold text-gray-500">S$</span>
              {summaryData.cost?.toLocaleString()}
            </span>
            {stageTypeTotals.length > 0 && breakdownCard("cost")}
          </button>
          <div className="text-left">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-500">Avg</span>
            <span className="text-lg font-extrabold tracking-tight text-gray-900 tabular-nums">
              {summaryData.avgKgPerDay}
              <span className="ml-1 text-[10px] font-semibold text-gray-500">kg/day</span>
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-2 border-t border-gray-100 pt-2.5 text-xs text-gray-400">Stage not reached yet</p>
      )}
    </div>
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      {title && (
        <div className="mb-2.5">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          {subtitle && (
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">{subtitle}</p>
          )}
        </div>
      )}
      <StageDayGrid
        template={template}
        days={gridDays}
        selectedStage={selectedStage}
        onSelectStage={onSelectStage}
        accentColor={color}
        stageIndicators={stageIndicators}
        infoFor={infoFor}
        summary={summary}
      />
    </div>
  );
}
