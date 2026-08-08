import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, LayoutDashboard, Link2, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { useProfile, useProfileTheme } from "../../context/ProfileContext";
import { getCurrentProjectId } from "../../utils/auth";
import { getComparisonColors } from "../../utils/profileColors";
import { apiService } from "../../services/api.service";
import { Card, CardContent } from "../ui/card";
import { ComparePanel } from "./ComparePanel";
import { CumulativeFeedChart } from "./CumulativeFeedChart";
import { DailyFeedChart } from "./DailyFeedChart";
import { DashboardFilters } from "./DashboardFilters";
import { FeedComposer } from "./FeedComposer";
import { FeedDayGrid } from "./FeedDayGrid";
import { FloatingAction } from "./FloatingAction";
import { KpiCards } from "./KpiCards";
import { hexA } from "./stageBandsPlugin";
import { assignTreatmentColors } from "./treatmentMarksPlugin";
import type {
  FeedingCycleOption,
  FeedingDashboardResponse,
  FeedingOptionsResponse,
  FeedingPondOption,
  Stage,
} from "./types";

type ChartViewMode = "stacked" | "side-by-side";

export function cycleLabel(pond: FeedingPondOption | undefined, cycleId: string): string {
  if (!pond) return "Cycle";
  const index = pond.cycles.findIndex((c) => c.cycleId === cycleId);
  return `${pond.name} · Cycle ${index + 1}`;
}

function findPondOfCycle(ponds: FeedingPondOption[], cycleId: string): FeedingPondOption | undefined {
  return ponds.find((p) => p.cycles.some((c) => c.cycleId === cycleId));
}

function defaultCycleId(cycles: FeedingCycleOption[]): string | null {
  if (!cycles.length) return null;
  const ongoing = [...cycles].reverse().find((c) => c.status === "ongoing");
  return (ongoing ?? cycles[cycles.length - 1]).cycleId;
}

function stageOfDay(stages: Stage[], day: number): number {
  const index = stages.findIndex((s) => day >= s.startDay && day <= s.endDay);
  return index >= 0 ? index : Math.max(stages.length - 1, 0);
}

export function DashboardTab({ refreshSignal = 0 }: { refreshSignal?: number } = {}) {
  const { currentProfile } = useProfile();
  const projectId = getCurrentProjectId();

  const theme = useProfileTheme();
  const comparisonColors = getComparisonColors(currentProfile);

  const [options, setOptions] = useState<FeedingOptionsResponse | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [pondId, setPondId] = useState<string | null>(null);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [dash, setDash] = useState<FeedingDashboardResponse | null>(null);
  // The comparison is fully decoupled from the dashboard selection above
  // (consultant, 27 Jul 2026): it has its own pair and its own payload.
  const [cmpPair, setCmpPair] = useState<{ baseId: string; cmpId: string } | null>(null);
  const [cmpDash, setCmpDash] = useState<FeedingDashboardResponse | null>(null);
  const [dashError, setDashError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ChartViewMode>("stacked");
  const [stageSel, setStageSel] = useState(0);
  const [cmpStageA, setCmpStageA] = useState(0);
  const [cmpStageB, setCmpStageB] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const stagedCycleRef = useRef<string | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const compareRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    apiService
      .getFeedingOptions(projectId)
      .then((data) => {
        if (cancelled) return;
        setOptions(data);
        setOptionsError(null);
        const firstPond = data.ponds.find((p) => p.cycles.length > 0) ?? data.ponds[0];
        if (firstPond) {
          setPondId((prev) => (prev && data.ponds.some((p) => p.pondId === prev) ? prev : firstPond.pondId));
          setCycleId((prev) => {
            if (prev && data.ponds.some((p) => p.cycles.some((c) => c.cycleId === prev))) return prev;
            return defaultCycleId(firstPond.cycles);
          });
        }
      })
      .catch(() => {
        if (!cancelled) setOptionsError("Could not load feeding data for this project.");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey, refreshSignal]);

  useEffect(() => {
    if (!projectId || !cycleId) return;
    let cancelled = false;
    apiService
      .getFeedingDashboard({ projectId, cycleId })
      .then((data) => {
        if (cancelled) return;
        setDash(data);
        setDashError(null);
        if (data.cycle.cycleId !== stagedCycleRef.current) {
          stagedCycleRef.current = data.cycle.cycleId;
          const index =
            data.cycle.endDate == null ? stageOfDay(data.template.stages, data.cycle.elapsedDays) : 0;
          setStageSel(index);
        }
      })
      .catch(() => {
        if (!cancelled) setDashError("Could not load the feeding dashboard.");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, cycleId, refreshKey, refreshSignal]);

  useEffect(() => {
    if (!projectId || !cmpPair) {
      setCmpDash(null);
      return;
    }
    let cancelled = false;
    apiService
      .getFeedingDashboard({ projectId, cycleId: cmpPair.baseId, compareId: cmpPair.cmpId })
      .then((data) => {
        if (cancelled) return;
        setCmpDash(data);
        const index =
          data.cycle.endDate == null ? stageOfDay(data.template.stages, data.cycle.elapsedDays) : 0;
        setCmpStageA(index);
        setCmpStageB(index);
      })
      .catch(() => {
        if (!cancelled) setCmpDash(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, cmpPair, refreshKey, refreshSignal]);

  const onSaved = useCallback(() => setRefreshKey((k) => k + 1), []);

  const pond = options?.ponds.find((p) => p.pondId === pondId);
  const selLabel = pond && cycleId ? cycleLabel(pond, cycleId) : "";
  const cmpBasePond = cmpDash ? findPondOfCycle(options?.ponds ?? [], cmpDash.cycle.cycleId) : undefined;
  const cmpCmpPond = cmpDash?.compare ? findPondOfCycle(options?.ponds ?? [], cmpDash.compare.cycleId) : undefined;
  const cmpBaseLabel = cmpDash ? cycleLabel(cmpBasePond, cmpDash.cycle.cycleId) : "";
  const cmpLabel = cmpDash?.compare ? cycleLabel(cmpCmpPond, cmpDash.compare.cycleId) : "";
  const stagesInSync = cmpStageA === cmpStageB;
  const colorA = comparisonColors.pondA;
  const colorB = comparisonColors.pondB;

  const treatmentColors = useMemo(
    () => assignTreatmentColors(dash?.treatments.base ?? [], []),
    [dash],
  );
  const cmpTreatmentColors = useMemo(
    () =>
      assignTreatmentColors(
        cmpDash?.treatments.base ?? [],
        cmpDash?.treatments.compare ?? [],
      ),
    [cmpDash],
  );

  const soloKpis = dash ? dash.kpis.base : null;
  const soloStageSummaries = dash ? dash.stageSummaries.base : [];

  const sync = useMemo(() => {
    if (!cmpDash?.days.compare) return null;
    const dailyMax = Math.max(
      ...cmpDash.days.base.map((d) => d.totalKg),
      ...cmpDash.days.compare.map((d) => d.totalKg),
    );
    const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
    const cumMax = Math.max(
      sum(cmpDash.days.base.map((d) => d.totalKg)),
      sum(cmpDash.days.compare.map((d) => d.totalKg)),
    );
    return { dailyMax, cumMax };
  }, [cmpDash]);

  const changePond = (pid: string) => {
    const next = options?.ponds.find((p) => p.pondId === pid);
    setPondId(pid);
    setCycleId(next ? defaultCycleId(next.cycles) : null);
    setStageSel(0);
  };

  const changeCycle = (cid: string) => {
    setCycleId(cid);
    setStageSel(0);
  };

  const applyCompare = (baseId: string, cmpId: string) => {
    setCmpPair({ baseId, cmpId });
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    compareRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const clearCompare = () => setCmpPair(null);

  if (optionsError) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{optionsError}</div>;
  }
  if (!options || !pond || !cycleId) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading feeding data…</div>
    );
  }

  return (
    <div className="space-y-4">
      <div ref={topRef} className="scroll-mt-4">
        <div
          className="space-y-4 rounded-xl border-2 p-3 sm:p-4"
          style={{ borderColor: hexA(theme.primary, 0.55), backgroundColor: hexA(theme.primary, 0.03) }}
        >
        <DashboardFilters
          ponds={options.ponds}
          pondId={pond.pondId}
          cycleId={cycleId}
          onPondChange={changePond}
          onCycleChange={changeCycle}
        />

        {dashError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{dashError}</div>
        )}

        {dash && soloKpis && (
          <>
            <KpiCards
              kpis={{ base: soloKpis, compare: null, changes: null }}
              base={dash.cycle}
              compare={null}
              horizonDays={dash.cycle.elapsedDays}
              baseLabel={selLabel}
              cmpLabel=""
              color={theme.primary}
              cmpColor={colorB}
            />

            <FeedDayGrid
              template={dash.template}
              cycle={dash.cycle}
              days={dash.days.base}
              stageSummaries={soloStageSummaries}
              selectedStage={stageSel}
              onSelectStage={setStageSel}
              color={theme.primary}
              title="Stage breakdown"
              subtitle="Daily feeding"
            />

            <div className="grid grid-cols-1 gap-4">
              <DailyFeedChart
                template={dash.template}
                days={dash.days.base}
                cmpDays={null}
                seriesLabel={selLabel}
                color={theme.primary}
                cmpColor={colorB}
              />
              <CumulativeFeedChart
                template={dash.template}
                days={dash.days.base}
                cmpDays={null}
                seriesLabel={selLabel}
                color={theme.primary}
                cmpColor={colorB}
                treatments={treatmentColors.base}
              />
            </div>
          </>
        )}
        </div>
      </div>

      {dash && (
        <div ref={composerRef} className="scroll-mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white">
              <Plus className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-gray-900">Log feeding</h3>
          </div>
          <FeedComposer
            template={dash.template}
            cycle={dash.cycle}
            days={dash.days.base}
            feedTypes={options.feedTypes}
            color={theme.primary}
            projectId={projectId ?? ""}
            onSaved={onSaved}
            onTypesChanged={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      )}

      {dash && (
        <div ref={compareRef} className="scroll-mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white">
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-bold text-gray-900">Compare</h3>
          </div>

          <div
            className="space-y-3 rounded-xl border-2 p-3 sm:p-4"
            style={{ borderColor: hexA(theme.primary, 0.55), backgroundColor: hexA(theme.primary, 0.03) }}
          >
          <ComparePanel
            ponds={options.ponds}
            colorA={colorA}
            colorB={colorB}
            applied={cmpPair}
            onApply={applyCompare}
            onClear={clearCompare}
          />

          {cmpDash && cmpDash.compare && (
            <>
              <KpiCards
                kpis={cmpDash.kpis}
                base={cmpDash.cycle}
                compare={cmpDash.compare}
                horizonDays={cmpDash.horizonDays}
                baseLabel={cmpBaseLabel}
                cmpLabel={cmpLabel}
                color={colorA}
                cmpColor={colorB}
              />

              <Card>
                <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-gray-900">Stage breakdown</h3>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Daily feeding</p>
                  </div>
                  {stagesInSync ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                      <Link2 className="h-3.5 w-3.5" /> Stages synced
                    </span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600">
                        <TriangleAlert className="h-3.5 w-3.5" /> Different stages
                        <span className="font-medium opacity-75">· not comparable</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setCmpStageB(cmpStageA)}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-[11px] font-bold text-amber-700 hover:bg-amber-50"
                      >
                        <RefreshCw className="h-3 w-3" /> Re-sync
                      </button>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-xl border-2 bg-white p-3" style={{ borderColor: colorA }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colorA }}>
                      {cmpBaseLabel}
                    </p>
                    <FeedDayGrid
                      template={cmpDash.template}
                      cycle={cmpDash.cycle}
                      days={cmpDash.days.base}
                      stageSummaries={cmpDash.stageSummaries.base}
                      selectedStage={cmpStageA}
                      onSelectStage={setCmpStageA}
                      color={colorA}
                    />
                  </div>
                  <div className="space-y-2 rounded-xl border-2 bg-white p-3" style={{ borderColor: colorB }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colorB }}>
                      {cmpLabel}
                    </p>
                    <FeedDayGrid
                      template={cmpDash.template}
                      cycle={cmpDash.compare}
                      days={cmpDash.days.compare!}
                      stageSummaries={cmpDash.stageSummaries.compare!}
                      selectedStage={cmpStageB}
                      onSelectStage={setCmpStageB}
                      color={colorB}
                    />
                  </div>
                </div>
                </CardContent>
              </Card>

              <div className="flex items-center gap-2">
                {(["stacked", "side-by-side"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      viewMode === mode ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {mode === "stacked" ? "Stacked" : "Side-by-Side"}
                  </button>
                ))}
              </div>

              {viewMode === "stacked" ? (
                <div className="grid grid-cols-1 gap-4">
                  <DailyFeedChart
                    template={cmpDash.template}
                    days={cmpDash.days.base}
                    cmpDays={cmpDash.days.compare}
                    seriesLabel={cmpBaseLabel}
                    cmpSeriesLabel={cmpLabel}
                    color={colorA}
                    cmpColor={colorB}
                  />
                  <CumulativeFeedChart
                    template={cmpDash.template}
                    days={cmpDash.days.base}
                    cmpDays={cmpDash.days.compare}
                    seriesLabel={cmpBaseLabel}
                    cmpSeriesLabel={cmpLabel}
                    color={colorA}
                    cmpColor={colorB}
                    treatments={cmpTreatmentColors.base}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-3 rounded-xl border-2 bg-white p-3" style={{ borderColor: colorA }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colorA }}>
                      {cmpBaseLabel}
                    </p>
                    <DailyFeedChart
                      template={cmpDash.template}
                      days={cmpDash.days.base}
                      cmpDays={null}
                      seriesLabel={cmpBaseLabel}
                      color={colorA}
                      cmpColor={colorB}
                      yMax={sync?.dailyMax}
                    />
                    <CumulativeFeedChart
                      template={cmpDash.template}
                      days={cmpDash.days.base}
                      cmpDays={null}
                      seriesLabel={cmpBaseLabel}
                      color={colorA}
                      cmpColor={colorB}
                      yMax={sync?.cumMax}
                      treatments={cmpTreatmentColors.base}
                    />
                  </div>
                  <div className="space-y-3 rounded-xl border-2 bg-white p-3" style={{ borderColor: colorB }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colorB }}>
                      {cmpLabel}
                    </p>
                    <DailyFeedChart
                      template={cmpDash.template}
                      days={cmpDash.days.compare!}
                      cmpDays={null}
                      seriesLabel={cmpLabel}
                      color={colorB}
                      cmpColor={colorB}
                      yMax={sync?.dailyMax}
                    />
                    <CumulativeFeedChart
                      template={cmpDash.template}
                      days={cmpDash.days.compare!}
                      cmpDays={null}
                      seriesLabel={cmpLabel}
                      color={colorB}
                      cmpColor={colorB}
                      yMax={sync?.cumMax}
                      treatments={cmpTreatmentColors.cmp}
                    />
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      )}

      {dash && (
        <>
          <FloatingAction label="Compare" targetRef={compareRef}>
            <ArrowRightLeft className="h-4 w-4" />
          </FloatingAction>
          <FloatingAction label="Log feeding" targetRef={composerRef} bottomClass="bottom-[5rem]">
            <Plus className="h-4 w-4" />
          </FloatingAction>
          <FloatingAction label="Dashboard" targetRef={topRef} bottomClass="bottom-[8.25rem]">
            <LayoutDashboard className="h-4 w-4" />
          </FloatingAction>
        </>
      )}
    </div>
  );
}
