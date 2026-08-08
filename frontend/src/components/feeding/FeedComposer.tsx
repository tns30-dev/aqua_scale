import { useEffect, useRef, useState } from "react";
import { ArrowLeft, History, ListChecks, Plus, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { Input } from "../ui/input";
import { apiService } from "../../services/api.service";
import { FeedTypePicker } from "./FeedTypePicker";
import { fmtD } from "./format";
import { hexA } from "./stageBandsPlugin";
import type {
  CycleTemplate,
  FeedEntryWrite,
  FeedingCycleInfo,
  FeedingDay,
  FeedingFeedType,
} from "./types";

/**
 * The feeding input surface (consultant redesign, 18 Jul 2026): an
 * always-visible card aimed at TODAY, replacing the day-modal and the
 * Excel bulk upload. "Log another day" unfolds the day-chip strip — sized
 * to exactly one line of chips (derived from the container width); every
 * "More" adds one more full line. A plain tap RE-AIMS at that day (its
 * record pre-populates the boxes); batch selection lives behind the
 * explicit "Pick several days" switch.
 */

const AMBER = "#D97706";
const CHIP_MIN = 76;
const CHIP_GAP = 6;

interface FeedComposerProps {
  template: CycleTemplate;
  cycle: FeedingCycleInfo;
  days: FeedingDay[];
  feedTypes: FeedingFeedType[];
  color: string;
  projectId: string;
  onSaved: () => void;
  onTypesChanged: () => void;
}

interface Row {
  feedLogId?: string;
  typeId: string;
  amount: string;
  time: string;
}

export function FeedComposer({ template, cycle, days, feedTypes, color, projectId, onSaved, onTypesChanged }: FeedComposerProps) {
  const ongoing = cycle.endDate == null;
  const lastDay = cycle.elapsedDays;

  const [selected, setSelected] = useState<number[]>([lastDay]);
  const [stripOpen, setStripOpen] = useState(!ongoing);
  const [multiMode, setMultiMode] = useState(false);
  const [stripRows, setStripRows] = useState(1);
  // Swaps the whole strip to upcoming-days-only (pre-adding future feed,
  // consultant ask 18 Jul). Ongoing cycles only.
  const [upcomingView, setUpcomingView] = useState(false);
  // Swaps the strip to one stage's days (owner ask 18 Jul) — same swap
  // mechanism as the upcoming pill; the views are mutually exclusive.
  const [stageView, setStageView] = useState<number | null>(null);
  const [stripCols, setStripCols] = useState(7);
  const [rows, setRows] = useState<Row[]>([]);
  const [stocking, setStocking] = useState("");
  const [harvest, setHarvest] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tap-to-toggle for the totals' per-type breakdown cards (mobile has no
  // hover); a tap anywhere else closes the open card.
  const [openBreakdown, setOpenBreakdown] = useState<"feed" | "cost" | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openBreakdown) return;
    const close = () => setOpenBreakdown(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openBreakdown]);

  // One strip line = as many chips as the container fits (deterministic
  // from width); re-measured on resize.
  useEffect(() => {
    if (!stripOpen) return;
    const measure = () => {
      const width = stripRef.current?.clientWidth ?? 0;
      if (width > 0) setStripCols(Math.max(3, Math.floor((width + CHIP_GAP) / (CHIP_MIN + CHIP_GAP))));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [stripOpen]);

  const loadRowsFor = (day: number): Row[] => {
    const entries = days[day - 1]?.entries ?? [];
    return entries.length
      ? entries.map((e) => ({ feedLogId: e.feedLogId, typeId: e.feedTypeId, amount: String(e.amountKg), time: e.fedTime ?? "" }))
      : [{ typeId: feedTypes[0]?.feedTypeId ?? "", amount: "", time: "" }];
  };

  // One-tap logging (consultant ask 23 Jul): an empty TODAY prefills with
  // the latest fed day of this cycle — every number shown is one that
  // really happened ("Same as Day N"). Rows whose feed type is no longer
  // served drop out; all dropped → normal empty seed.
  const [prefillDay, setPrefillDay] = useState<number | null>(null);

  const prefillFor = (day: number): { rows: Row[]; sourceDay: number } | null => {
    if ((days[day - 1]?.entries ?? []).length) return null;
    for (let d = day - 1; d >= 1; d--) {
      const entries = days[d - 1]?.entries ?? [];
      if (!entries.length) continue;
      const copied = entries
        .filter((e) => feedTypes.some((t) => t.feedTypeId === e.feedTypeId))
        .map((e) => ({ typeId: e.feedTypeId, amount: String(e.amountKg), time: e.fedTime ?? "" }));
      return copied.length ? { rows: copied, sourceDay: d } : null;
    }
    return null;
  };

  const aimRows = (day: number, allowPrefill: boolean) => {
    if (allowPrefill && ongoing && day === lastDay) {
      const pre = prefillFor(day);
      if (pre) {
        setRows(pre.rows);
        setPrefillDay(pre.sourceDay);
        return;
      }
    }
    setPrefillDay(null);
    setRows(loadRowsFor(day));
  };

  // Any manual change to the rows retires the "Same as Day N" claim.
  const editRows = (next: Row[]) => {
    setPrefillDay(null);
    setRows(next);
  };

  const firstAmountRef = useRef<HTMLInputElement | null>(null);
  const focusFirstAmount = () => {
    firstAmountRef.current?.focus();
    firstAmountRef.current?.select();
  };

  const prefillWhat =
    prefillDay != null
      ? `This is ${prefillDay === lastDay - 1 ? "yesterday's" : `Day ${prefillDay}'s`} feeding${
          days[prefillDay - 1] ? ` (${fmtD(days[prefillDay - 1].date)})` : ""
        }`
      : null;

  const prefillBody = (
    <span className="mt-1 flex flex-col gap-0.5 font-medium text-gray-600">
      <span className="flex gap-1.5">
        <span className="text-amber-500" aria-hidden="true">•</span>
        <span>{prefillWhat}</span>
      </span>
      <span className="flex gap-1.5">
        <span className="text-amber-500" aria-hidden="true">•</span>
        <span>Save if you fed the same today</span>
      </span>
    </span>
  );

  // Re-aim when the cycle switches; re-sync rows when the data refreshes
  // (after a save the replaced entries carry NEW feedLogIds — stale ids
  // would be rejected by the server).
  const cycleRef = useRef<string | null>(null);
  useEffect(() => {
    setStocking(cycle.stockingBiomassKg != null ? String(cycle.stockingBiomassKg) : "");
    setHarvest(cycle.harvestBiomassKg != null ? String(cycle.harvestBiomassKg) : "");
    if (cycleRef.current !== cycle.cycleId) {
      cycleRef.current = cycle.cycleId;
      setSelected([cycle.elapsedDays]);
      setStripOpen(cycle.endDate != null);
      setMultiMode(false);
      setStripRows(1);
      setUpcomingView(false);
      setStageView(null);
      aimRows(cycle.elapsedDays, cycle.endDate == null);
      setError(null);
      return;
    }
    setSelected((prev) => {
      if (prev.length === 1 && !multiMode) {
        aimRows(prev[0], !stripOpen);
        return prev;
      }
      // A data refresh while picking several days (i.e. after a batch
      // save) resets back to the single aimed day of the current view.
      setMultiMode(false);
      const aim =
        stageView != null && template.stages[stageView]
          ? template.stages[stageView].startDay
          : upcomingView && cycle.elapsedDays < days.length
            ? cycle.elapsedDays + 1
            : cycle.elapsedDays;
      aimRows(aim, false);
      return [aim];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, days]);

  // "Pick several days" mode is always batch semantics, even with one chip
  // — its rows carry no feedLogIds, so treating it as single would silently
  // clear the day's record on save.
  const single = !multiMode && selected.length === 1;
  const target = single ? selected[0] : null;
  // "Today" treatment only applies to the default view (strip closed) —
  // once the strip is open, even today's own chip is treated like any
  // other day (owner rule: no dynamic today-flip on the other-day side).
  const isToday = ongoing && target === lastDay && !stripOpen;
  const isStockingDay = single && target === 1;
  const isHarvestDay = single && !ongoing && target === lastDay;

  const stageNameOf = (day: number) =>
    template.stages.find((s) => day >= s.startDay && day <= s.endDay)?.name ??
    template.stages[template.stages.length - 1]?.name ?? "";

  const unitPriceOf = (typeId: string) => feedTypes.find((t) => t.feedTypeId === typeId)?.unitPrice ?? 0;

  const parsed: FeedEntryWrite[] = rows
    .map((row) => ({
      ...(single && row.feedLogId ? { feedLogId: row.feedLogId } : {}),
      feedTypeId: row.typeId,
      amountKg: Number(row.amount),
      fedTime: row.time || null,
    }))
    .filter((e) => e.feedTypeId && Number.isFinite(e.amountKg) && e.amountKg > 0);
  const totalKg = parsed.reduce((s, e) => s + e.amountKg, 0);
  const totalCost = parsed.reduce((s, e) => s + e.amountKg * unitPriceOf(e.feedTypeId), 0);

  // Per-type totals matching the stats' scope: TODAY mode = just the
  // composed rows; any other mode = the projected cycle (every recorded
  // day except the selected ones at server costs + composed × N at est).
  const typeBreakdown = (() => {
    const totals = new Map<string, { kg: number; cost: number }>();
    const add = (name: string, kg: number, cost: number) => {
      const t = totals.get(name) ?? { kg: 0, cost: 0 };
      t.kg += kg;
      t.cost += cost;
      totals.set(name, t);
    };
    if (!isToday) {
      days.forEach((d) => {
        if (selected.includes(d.day)) return;
        d.entries.forEach((e) => add(e.feedTypeName, e.amountKg, e.cost));
      });
    }
    parsed.forEach((e) => {
      const name = feedTypes.find((t) => t.feedTypeId === e.feedTypeId)?.name ?? "Feed";
      add(name, e.amountKg * selected.length, e.amountKg * unitPriceOf(e.feedTypeId) * selected.length);
    });
    return [...totals.entries()]
      .map(([name, t]) => ({ name, kg: Math.round(t.kg * 10) / 10, cost: Math.round(t.cost * 100) / 100 }))
      .sort((a, b) => b.kg - a.kg || a.name.localeCompare(b.name));
  })();

  const breakdownCard = (kind: "feed" | "cost") => (
    <span
      className={clsx(
        "pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-max -translate-x-1/2 flex-col gap-0.5 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg",
        openBreakdown === kind ? "flex" : "hidden group-hover:flex",
      )}
    >
      {typeBreakdown.map((t) => (
        <span key={t.name} className="flex items-center justify-between gap-4 text-[11px]">
          <span className="text-gray-500">{t.name}</span>
          <span className="font-semibold tabular-nums text-gray-900">
            {kind === "feed" ? `${t.kg} kg` : `S$ ${Math.round(t.cost).toLocaleString()}`}
          </span>
        </span>
      ))}
    </span>
  );

  // A normal tap RE-AIMS at that day (its record loads into the boxes —
  // owner: existing data must be pre-populated); chips only toggle into a
  // batch selection while the explicit "Pick several days" switch is on.
  const toggleDay = (day: number) => {
    setError(null);
    if (!multiMode) {
      setSelected([day]);
      aimRows(day, false);
      return;
    }
    setSelected((prev) => {
      // While picking several days the compose row is never attached to
      // any single day's record — it stays whatever is being composed,
      // even when the selection drops back to one chip.
      if (prev.includes(day)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const toggleMultiMode = () => {
    setMultiMode((prev) => {
      if (prev) {
        setSelected((sel) => {
          const keep = sel[0];
          aimRows(keep, false);
          return [keep];
        });
      } else {
        // Batch composing starts from zero (owner rule) — default feed
        // type, amount 0, never seeded with any day's values.
        setPrefillDay(null);
        setRows([{ typeId: feedTypes[0]?.feedTypeId ?? "", amount: "0", time: "" }]);
      }
      return !prev;
    });
  };

  const backToToday = () => {
    setSelected([lastDay]);
    aimRows(lastDay, true);
    setStripOpen(false);
    setMultiMode(false);
    setStripRows(1);
    setUpcomingView(false);
    setStageView(null);
    setError(null);
  };

  const reaim = (day: number) => {
    setSelected([day]);
    aimRows(day, false);
    setMultiMode(false);
    setStripRows(1);
    setError(null);
  };

  const toggleUpcomingView = () => {
    setUpcomingView((prev) => {
      const next = !prev;
      setStageView(null);
      reaim(next ? lastDay + 1 : lastDay);
      return next;
    });
  };

  const toggleStageView = (index: number) => {
    setStageView((prev) => {
      const next = prev === index ? null : index;
      setUpcomingView(false);
      reaim(next != null ? template.stages[index].startDay : lastDay);
      return next;
    });
  };

  // Chips fill whole lines: slots = cols × lines; when more days remain,
  // the last slot is the More button so every line stays exact. The past
  // view ends at today and More extends backward; the upcoming view starts
  // tomorrow and More extends forward (capped at the cycle's planned axis).
  const maxDay = days.length;
  // On a finished cycle, days past the harvest belong to the next cycle —
  // stage views clamp there; ongoing cycles run to the planned axis.
  const stageMax = ongoing ? maxDay : lastDay;
  const activeStage = stageView != null ? template.stages[stageView] : null;
  const slots = stripCols * stripRows;
  let stripFrom: number;
  let stripTo: number;
  let hasMore: boolean;
  if (activeStage) {
    const stageStart = activeStage.startDay;
    const stageEnd = Math.min(activeStage.endDay, stageMax);
    const available = stageEnd - stageStart + 1;
    hasMore = slots < available;
    const windowLen = hasMore ? slots - 1 : Math.min(slots, available);
    stripFrom = stageStart;
    stripTo = stageStart + Math.max(1, windowLen) - 1;
  } else if (upcomingView) {
    const available = maxDay - lastDay;
    hasMore = slots < available;
    const windowLen = hasMore ? slots - 1 : Math.min(slots, available);
    stripFrom = lastDay + 1;
    stripTo = lastDay + Math.max(1, windowLen);
  } else {
    hasMore = slots < lastDay;
    const windowLen = hasMore ? slots - 1 : Math.min(slots, lastDay);
    stripFrom = Math.max(1, lastDay - windowLen + 1);
    stripTo = lastDay;
  }
  const stripDays = Array.from({ length: stripTo - stripFrom + 1 }, (_, i) => stripFrom + i);
  const upcomingAvailable = ongoing && lastDay < maxDay;
  const selectableStages = template.stages
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => stage.startDay <= stageMax);
  const batchFedDays = single ? [] : selected.filter((d) => (days[d - 1]?.totalKg ?? 0) > 0);

  // The other-day side's totals ALWAYS speak for the ENTIRE cycle (owner
  // rule, 18 Jul): everything recorded, with the selected days replaced by
  // what is being composed — i.e. the cycle total AFTER saving. Live per
  // keystroke; the replace-vs-add confusion cannot arise because the
  // number is the end state, not the write.
  const existingOnSelected = selected.reduce(
    (acc, d) => {
      acc.kg += days[d - 1]?.totalKg ?? 0;
      acc.cost += days[d - 1]?.cost ?? 0;
      return acc;
    },
    { kg: 0, cost: 0 },
  );
  const recordedCycle = days.reduce(
    (acc, d) => {
      acc.kg += d.totalKg;
      acc.cost += d.cost;
      return acc;
    },
    { kg: 0, cost: 0 },
  );
  const cycleKg = recordedCycle.kg - existingOnSelected.kg + totalKg * selected.length;
  const cycleCost = recordedCycle.cost - existingOnSelected.cost + totalCost * selected.length;

  // TODAY view shows today's own totals; the other-day side shows the
  // cycle's totals (owner rule, 18 Jul).
  const statsKg = isToday ? totalKg : cycleKg;
  const statsCost = isToday ? totalCost : cycleCost;
  const statsScope = isToday ? "today" : "this cycle";

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const targets = [...selected].sort((a, b) => a - b);
      for (const day of targets) {
        const date = days[day - 1]?.date;
        if (!date) continue;
        await apiService.saveFeedDay({ pondId: cycle.pondId, date, entries: parsed });
      }

      if (single) {
        const stockingValue = stocking.trim() === "" ? null : Number(stocking);
        const harvestValue = harvest.trim() === "" ? null : Number(harvest);
        const biomassBody: { stockingBiomassKg?: number | null; harvestBiomassKg?: number | null } = {};
        if (isStockingDay && stockingValue !== cycle.stockingBiomassKg) {
          biomassBody.stockingBiomassKg = stockingValue;
        }
        if (isHarvestDay && harvestValue !== cycle.harvestBiomassKg) {
          biomassBody.harvestBiomassKg = harvestValue;
        }
        if (Object.keys(biomassBody).length) {
          await apiService.saveCycleBiomass({ cycleId: cycle.cycleId, ...biomassBody });
        }
      }

      onSaved();
    } catch {
      setError("Could not save. Please check the values and try again.");
    } finally {
      setSaving(false);
    }
  };

  const headerLabel = !single
    ? "Logging several days"
    : isToday
      ? "Today's feeding"
      : ongoing
        ? "Logging another day"
        : "Feeding record";
  const accent = single && isToday ? color : AMBER;
  const saveLabel = !single
    ? `Save ${selected.length} day${selected.length === 1 ? "" : "s"}`
    : isToday
      ? "Save today's feeding"
      : `Save day ${target}`;

  return (
    <div
      className="rounded-xl border-2 bg-white p-4"
      style={{ borderColor: hexA(accent, 0.55), backgroundColor: hexA(accent, 0.03) }}
    >
      <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: accent }}>
        {headerLabel}
      </p>

      {stripOpen && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={toggleMultiMode}
            aria-pressed={multiMode}
            className="group flex items-center gap-2 text-[10px] font-bold"
          >
            <span
              className={clsx(
                "relative h-[18px] w-8 shrink-0 rounded-full transition-colors duration-200",
                multiMode ? "bg-amber-500" : "bg-gray-300 group-hover:bg-gray-400",
              )}
            >
              <span
                className={clsx(
                  "absolute top-[2px] left-[2px] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[8px] text-amber-600 shadow transition-transform duration-200",
                  multiMode && "translate-x-[14px]",
                )}
              >
                {multiMode ? "✓" : ""}
              </span>
            </span>
            <ListChecks className={clsx("h-3.5 w-3.5", multiMode ? "text-amber-600" : "text-gray-400")} />
            <span className={multiMode ? "text-amber-700" : "text-gray-600"}>
              {multiMode ? "Picking several days · tap the days to include" : "Pick several days"}
            </span>
          </button>
          <span className="flex flex-wrap items-center gap-1.5">
            {selectableStages.map(({ stage, index }) => (
              <button
                key={stage.name}
                type="button"
                onClick={() => toggleStageView(index)}
                aria-pressed={stageView === index}
                className={clsx(
                  "rounded-full border px-2.5 py-0.5 text-[10px] font-bold",
                  stageView === index ? "text-white" : "border-gray-300 bg-white text-gray-600 hover:border-gray-400",
                )}
                style={stageView === index ? { backgroundColor: stage.color, borderColor: stage.color } : undefined}
              >
                {stageView === index ? "✓ " : ""}
                {stage.name}
              </button>
            ))}
            {upcomingAvailable && (
              <button
                type="button"
                onClick={toggleUpcomingView}
                aria-pressed={upcomingView}
                className={clsx(
                  "rounded-full border px-2.5 py-0.5 text-[10px] font-bold",
                  upcomingView
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-gray-300 bg-white text-gray-600 hover:border-gray-400",
                )}
              >
                {upcomingView ? "✓ Picking upcoming days" : "Pick upcoming days"}
              </button>
            )}
          </span>
        </div>
      )}
      {stripOpen && (
        <div
          ref={stripRef}
          className="mt-2 grid"
          style={{ gridTemplateColumns: `repeat(${stripCols}, minmax(0, 1fr))`, gap: CHIP_GAP }}
        >
          {stripDays.map((day) => {
            const fed = (days[day - 1]?.totalKg ?? 0) > 0;
            const isSel = selected.includes(day);
            const isFuture = day > lastDay;
            const missed = !fed && !isFuture;
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                aria-pressed={isSel}
                className={clsx(
                  "rounded-lg border px-2 py-1 text-center text-[10px] font-bold leading-tight",
                  isSel
                    ? "text-white"
                    : missed
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : isFuture && !fed
                        ? "border-gray-200 bg-gray-50 text-gray-400"
                        : "border-gray-200 bg-white text-gray-500",
                )}
                style={isSel ? { backgroundColor: missed ? AMBER : color, borderColor: missed ? AMBER : color } : undefined}
              >
                {isSel ? "✓ " : ""}D{day}
                <span className={clsx("block text-[8px] font-semibold", isSel ? "text-white/80" : "text-gray-400")}>
                  {days[day - 1] ? fmtD(days[day - 1].date) : ""}
                </span>
              </button>
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => setStripRows((r) => r + 1)}
              className="rounded-lg border border-dashed border-gray-300 px-2 py-1.5 text-[10px] font-bold text-gray-500 hover:border-gray-400 hover:text-gray-700"
            >
              More ▾
            </button>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {single ? (
          <>
            <span className="text-base font-extrabold text-gray-900">Day {target}</span>
            <span className="text-xs text-gray-500">
              · {days[target! - 1] ? fmtD(days[target! - 1].date) : ""} · {stageNameOf(target!)}
            </span>
          </>
        ) : (
          <>
            <span className="text-base font-extrabold text-gray-900">{selected.length} days selected</span>
            <span className="text-xs text-gray-500">· {selected.map((d) => `D${d}`).join(" · ")}</span>
          </>
        )}
      </div>

      {prefillWhat && isToday && (
        <div className="mt-3 lg:hidden">
          <button
            type="button"
            onClick={focusFirstAmount}
            className="flex w-full flex-col rounded-xl border border-gray-200 bg-white p-3 text-left text-[11px] shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none"
          >
            <span className="flex items-center gap-1.5 font-bold text-gray-900">
              <History className="h-3.5 w-3.5 flex-none text-amber-500" aria-hidden="true" />
              Not saved yet
            </span>
            {prefillBody}
          </button>
        </div>
      )}
      {!single && (
        <p className="mt-1 text-[11px] text-gray-500">The same feeding below will be saved to every selected day.</p>
      )}
      {batchFedDays.length > 0 && (
        <p className="mt-1 text-[11px] font-semibold text-amber-700">
          {batchFedDays.map((d) => `Day ${d}`).join(", ")} already {batchFedDays.length === 1 ? "has" : "have"} feeding
          recorded. Saving replaces it.
        </p>
      )}

      {(isStockingDay || isHarvestDay) && (
        <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 md:max-w-xl">
          {isStockingDay && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-700">Stocking biomass</span>
              <div className="relative w-32">
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="—"
                  value={stocking}
                  onChange={(e) => setStocking(e.target.value)}
                  className="h-9 bg-white pr-8 text-xs"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-400">
                  kg
                </span>
              </div>
            </div>
          )}
          {isHarvestDay && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-700">Harvest biomass</span>
              <div className="relative w-32">
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="—"
                  value={harvest}
                  onChange={(e) => setHarvest(e.target.value)}
                  className="h-9 bg-white pr-8 text-xs"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-400">
                  kg
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="relative mt-3 md:max-w-xl">
        {prefillWhat && isToday && (
          <button
            type="button"
            onClick={focusFirstAmount}
            className="absolute left-full top-0 ml-4 hidden w-64 flex-col rounded-xl border border-gray-200 bg-white p-3 text-left text-[11px] shadow-lg animate-in fade-in slide-in-from-right-2 duration-300 hover:border-gray-300 motion-reduce:animate-none lg:flex"
          >
            <span
              className="absolute -left-[5px] top-4 h-2.5 w-2.5 rotate-45 border-b border-l border-gray-200 bg-white"
              aria-hidden="true"
            />
            <span className="flex items-center gap-1.5 font-bold text-gray-900">
              <ArrowLeft
                className="h-3.5 w-3.5 flex-none text-amber-500 motion-safe:animate-pulse"
                aria-hidden="true"
              />
              Not saved yet
            </span>
            {prefillBody}
          </button>
        )}
        <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <FeedTypePicker
              projectId={projectId}
              value={row.typeId}
              valueName={feedTypes.find((t) => t.feedTypeId === row.typeId)?.name ?? ""}
              onPick={(v) => editRows(rows.map((r, j) => (j === i ? { ...r, typeId: v } : r)))}
              onTypesChanged={onTypesChanged}
            />
            <div className="relative w-28">
              <Input
                ref={i === 0 ? firstAmountRef : undefined}
                type="number"
                min="0"
                step="0.1"
                placeholder="0.0"
                value={row.amount}
                onChange={(e) => editRows(rows.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))}
                className="h-9 bg-white pr-8 text-xs"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-400">
                kg
              </span>
            </div>
            <Input
              type="time"
              title="Feeding time (optional)"
              value={row.time}
              onChange={(e) => editRows(rows.map((r, j) => (j === i ? { ...r, time: e.target.value } : r)))}
              className="h-9 w-[6.75rem] bg-white text-xs"
            />
            <button
              type="button"
              onClick={() => editRows(rows.filter((_, j) => j !== i))}
              title="Remove feeding"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => editRows([...rows, { typeId: feedTypes[0]?.feedTypeId ?? "", amount: "", time: "" }])}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-semibold text-gray-500 hover:border-gray-400 hover:text-gray-700"
        >
          <Plus className="h-3.5 w-3.5" /> Add feeding
        </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-white/70 px-3 py-2 text-xs">
        <span className="text-gray-500">
          {parsed.length} feeding{parsed.length === 1 ? "" : "s"}
          {!single && " each day"}
        </span>
        <span className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            className={clsx("relative text-left", typeBreakdown.length > 0 && "group cursor-help")}
            onClick={(e) => {
              e.stopPropagation();
              setOpenBreakdown((prev) => (prev === "feed" ? null : "feed"));
            }}
          >
            <span className="mr-1 text-[9px] font-semibold uppercase tracking-wide text-gray-400">
              Total feed · {statsScope}
            </span>
            <span
              className={clsx(
                "font-bold tabular-nums text-gray-900",
                typeBreakdown.length > 0 && "underline decoration-gray-300 decoration-dotted underline-offset-2",
              )}
            >
              {Math.round(statsKg * 10) / 10} kg
            </span>
            {typeBreakdown.length > 0 && breakdownCard("feed")}
          </button>
          <button
            type="button"
            className={clsx("relative text-left", typeBreakdown.length > 0 && "group cursor-help")}
            onClick={(e) => {
              e.stopPropagation();
              setOpenBreakdown((prev) => (prev === "cost" ? null : "cost"));
            }}
          >
            <span className="mr-1 text-[9px] font-semibold uppercase tracking-wide text-gray-400">
              Est. cost · {statsScope}
            </span>
            <span
              className={clsx(
                "tabular-nums text-gray-700",
                typeBreakdown.length > 0 && "underline decoration-gray-300 decoration-dotted underline-offset-2",
              )}
            >
              S$ {Math.round(statsCost).toLocaleString()}
            </span>
            {typeBreakdown.length > 0 && breakdownCard("cost")}
          </button>
        </span>
      </div>

      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}

      <div className="mt-3 flex flex-col items-stretch gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || (!single && parsed.length === 0)}
          className="rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ backgroundColor: accent }}
        >
          {saving ? "Saving…" : saveLabel}
        </button>
        <div className="text-center text-[11px] text-gray-500">
          {!stripOpen ? (
            <button type="button" onClick={() => setStripOpen(true)} className="underline underline-offset-2">
              Missed a day? Log another day
            </button>
          ) : ongoing ? (
            <button type="button" onClick={backToToday} className="underline underline-offset-2">
              Back to today
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
