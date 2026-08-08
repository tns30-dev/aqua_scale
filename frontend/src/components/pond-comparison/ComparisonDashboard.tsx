import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { ComparisonChart } from "../charts/ComparisonChart";
import { useProfileTheme, useProfile } from "../../context/ProfileContext";
import { ComparisonSetup } from "./ComparisonSetup";
import { PondPanel } from "./PondPanel";
import { hexA, isoDaysAgo, todayIso } from "./format";
import { getComparisonColors } from "../../utils/profileColors";
import { useSession } from "../../context/SessionContext";
import { apiService } from "../../services/api.service";
import { getCurrentProjectId } from "../../utils/auth";
import type {
  PondComparisonChart,
  PondComparisonPondOption,
  PondComparisonResponse,
} from "../../types";

function badgeFromGrouping(grouping: PondComparisonResponse["dateRange"]["grouping"]): string {
  return grouping.charAt(0).toUpperCase() + grouping.slice(1);
}

function errorText(error: unknown, fallback: string): string {
  const e = error as { response?: { data?: { detail?: string } }; message?: string };
  return e.response?.data?.detail ?? e.message ?? fallback;
}

export function ComparisonDashboard() {
  const theme = useProfileTheme();
  const { currentProfile } = useProfile();
  const comparisonColors = getComparisonColors(currentProfile);
  const { projects } = useSession();
  const projectId = getCurrentProjectId();
  const project = useMemo(
    () => projects.find((item) => item.projectId === projectId) ?? null,
    [projects, projectId],
  );

  const [options, setOptions] = useState<PondComparisonPondOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [draftPondAId, setDraftPondAId] = useState("");
  const [draftPondBId, setDraftPondBId] = useState("");
  const [draftFromDate, setDraftFromDate] = useState(isoDaysAgo(30));
  const [draftToDate, setDraftToDate] = useState(todayIso());

  const [comparison, setComparison] = useState<PondComparisonResponse | null>(null);
  const [appliedQuery, setAppliedQuery] = useState<{
    pondAId: string;
    pondBId: string;
    startDate: string;
    endDate: string;
  } | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [chartViewMode, setChartViewMode] = useState<"stacked" | "side-by-side">("stacked");

  useEffect(() => {
    if (!projectId) {
      setOptions([]);
      setComparison(null);
      setAppliedQuery(null);
      return;
    }
    let cancelled = false;
    setComparison(null);
    setAppliedQuery(null);
    setApplyError(null);
    setOptionsLoading(true);
    setOptionsError(null);

    apiService
      .getPondComparisonOptions(projectId)
      .then((response) => {
        if (cancelled) return;
        setOptions(response.ponds);
        const withData = response.ponds.filter((pond) => pond.hasSensorData);
        const seeds = withData.length >= 2 ? withData : response.ponds;
        setDraftPondAId(seeds[0]?.pondId ?? "");
        setDraftPondBId(seeds[1]?.pondId ?? "");
      })
      .catch((error) => {
        if (!cancelled) setOptionsError(errorText(error, "Failed to load ponds"));
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const fetchComparison = useCallback(
    async (
      query: { pondAId: string; pondBId: string; startDate: string; endDate: string },
      parameters: string[] | null,
    ) => {
      if (!projectId) return;
      setApplyLoading(true);
      setApplyError(null);
      try {
        const data = await apiService.getPondComparison({
          projectId,
          ...query,
          ...(parameters ? { parameters } : {}),
        });
        setComparison(data);
        setAppliedQuery(query);
      } catch (error) {
        setApplyError(errorText(error, "Failed to load comparison"));
      } finally {
        setApplyLoading(false);
      }
    },
    [projectId],
  );

  const validationHint =
    draftPondAId && draftPondBId && draftPondAId === draftPondBId
      ? "Pick two different ponds."
      : draftFromDate && draftToDate && draftToDate < draftFromDate
      ? "The end date must be on or after the start date."
      : "";

  const applyDisabled =
    applyLoading ||
    !draftPondAId ||
    !draftPondBId ||
    !draftFromDate ||
    !draftToDate ||
    validationHint !== "";

  const handleApply = useCallback(() => {
    if (applyDisabled) return;
    void fetchComparison(
      {
        pondAId: draftPondAId,
        pondBId: draftPondBId,
        startDate: draftFromDate,
        endDate: draftToDate,
      },
      null,
    );
  }, [applyDisabled, draftPondAId, draftPondBId, draftFromDate, draftToDate, fetchComparison]);

  const shownCodes = useMemo(
    () => comparison?.charts.map((chart) => chart.parameter) ?? [],
    [comparison],
  );
  const addableParams = useMemo(
    () =>
      (comparison?.availableParameters ?? []).filter(
        (param) => !shownCodes.includes(param.parameter),
      ),
    [comparison, shownCodes],
  );

  const removeParam = (code: string) => {
    if (!appliedQuery || shownCodes.length <= 1) return;
    void fetchComparison(appliedQuery, shownCodes.filter((item) => item !== code));
  };

  const addParam = (code: string) => {
    if (!appliedQuery || !code) return;
    void fetchComparison(appliedQuery, [...shownCodes, code]);
  };

  const resetParams = () => {
    if (!appliedQuery) return;
    void fetchComparison(appliedQuery, null);
  };

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
        No project assigned to your account. Contact a platform admin to grant project access.
      </div>
    );
  }

  if (!projectId || !project) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
        Pick a project from the dropdown at the top right to start comparing ponds.
      </div>
    );
  }

  return (
    <>
      {optionsError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {optionsError}
        </div>
      )}

      <ComparisonSetup
        ponds={options}
        pondAId={draftPondAId}
        pondBId={draftPondBId}
        fromDate={draftFromDate}
        toDate={draftToDate}
        onPondAChange={setDraftPondAId}
        onPondBChange={setDraftPondBId}
        onFromDateChange={setDraftFromDate}
        onToDateChange={setDraftToDate}
        onApply={handleApply}
        applyDisabled={applyDisabled}
        validationHint={validationHint}
        appliedRange={comparison ? comparison.dateRange : null}
        themeColor={theme.primary}
        colorA={comparisonColors.pondA}
        colorB={comparisonColors.pondB}
        parametersRow={
          comparison ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Comparing
              </span>
              {comparison.charts.map((chart) => {
                const label =
                  comparison.metrics.find((metric) => metric.parameter === chart.parameter)?.label ??
                  chart.title;
                return (
                  <span
                    key={chart.parameter}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-white py-1.5 pl-3 pr-1.5 text-[12px] font-bold text-gray-800 shadow-sm"
                    style={{ borderColor: hexA(theme.primary, 0.45) }}
                  >
                    {label}
                    <button
                      type="button"
                      aria-label={`Remove ${label}`}
                      title={shownCodes.length === 1 ? "At least one parameter stays on" : `Remove ${label}`}
                      disabled={applyLoading || shownCodes.length === 1}
                      onClick={() => removeParam(chart.parameter)}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:hover:bg-gray-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
              {addableParams.length > 0 && (
                <select
                  value=""
                  onChange={(event) => addParam(event.target.value)}
                  disabled={applyLoading}
                  aria-label="Add comparison parameter"
                  className="h-9 rounded-full border border-dashed bg-white px-3.5 text-[12px] font-bold shadow-sm"
                  style={{ borderColor: hexA(theme.primary, 0.55), color: theme.primary }}
                >
                  <option value="">+ Add parameter</option>
                  {addableParams.map((param) => (
                    <option key={param.parameter} value={param.parameter}>
                      {param.label}
                    </option>
                  ))}
                </select>
              )}
              {comparison.parameterSource === "custom" && (
                <button
                  type="button"
                  disabled={applyLoading}
                  onClick={resetParams}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold underline-offset-2 hover:underline disabled:opacity-50"
                  style={{ color: theme.primary }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Treatment watch-list
                </button>
              )}
            </div>
          ) : undefined
        }
      />

      {applyError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {applyError}
        </div>
      )}
      {applyLoading && (
        <div className="mb-3 rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Loading comparison...
        </div>
      )}

      {comparison && comparison.parameterSource === "default" && (
        <p className="mb-2 text-[11px] font-medium text-gray-500">
          No treatments in this period - showing the default water-quality set.
        </p>
      )}

      {comparison && (
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <PondPanel
            sideLabel="Pond A"
            side="A"
            color={comparisonColors.pondA}
            name={comparison.pondA.name}
            gpsLocation={
              options.find((pond) => pond.pondId === comparison.pondA.pondId)?.gpsLocation ?? ""
            }
            treatments={comparison.pondA.treatments}
            metrics={comparison.metrics}
          />
          <PondPanel
            sideLabel="Pond B"
            side="B"
            color={comparisonColors.pondB}
            name={comparison.pondB.name}
            gpsLocation={
              options.find((pond) => pond.pondId === comparison.pondB.pondId)?.gpsLocation ?? ""
            }
            treatments={comparison.pondB.treatments}
            metrics={comparison.metrics}
          />
        </div>
      )}

      {comparison ? (
        <>
          <div className="mt-5 mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setChartViewMode("stacked")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                chartViewMode === "stacked"
                  ? "bg-gray-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              Stacked
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode("side-by-side")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                chartViewMode === "side-by-side"
                  ? "bg-gray-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              Side-by-Side
            </button>
          </div>

          {chartViewMode === "stacked" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {comparison.charts.map((chart) => {
                const metric = comparison.metrics.find((item) => item.parameter === chart.parameter);
                return (
                  <ComparisonChart
                    key={chart.parameter}
                    variant={chart.variant}
                    title={chart.title}
                    unit={chart.unit}
                    watchedBy={metric?.watchedBy}
                    badge={badgeFromGrouping(comparison.dateRange.grouping)}
                    data={chart.data}
                    seriesALabel={comparison.pondA.name}
                    seriesBLabel={comparison.pondB.name}
                    seriesANoReadings={metric ? !metric.pondAHasReadings : false}
                    seriesBNoReadings={metric ? !metric.pondBHasReadings : false}
                    themeColor={theme.primary}
                    colorA={comparisonColors.pondA}
                    colorB={comparisonColors.pondB}
                  />
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SideBySideColumn
                pondName={comparison.pondA.name}
                color={comparisonColors.pondA}
                charts={comparison.charts}
                metrics={comparison.metrics}
                pickSeries="A"
                grouping={comparison.dateRange.grouping}
              />
              <SideBySideColumn
                pondName={comparison.pondB.name}
                color={comparisonColors.pondB}
                charts={comparison.charts}
                metrics={comparison.metrics}
                pickSeries="B"
                grouping={comparison.dateRange.grouping}
              />
            </div>
          )}
        </>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          {optionsLoading
            ? "Loading ponds..."
            : options.length < 2
            ? "This project needs at least 2 ponds to compare."
            : "Pick two ponds and a date range, then apply."}
        </div>
      )}
    </>
  );
}

interface SideBySideColumnProps {
  pondName: string;
  color: string;
  charts: PondComparisonChart[];
  metrics: PondComparisonResponse["metrics"];
  pickSeries: "A" | "B";
  grouping: PondComparisonResponse["dateRange"]["grouping"];
}

function SideBySideColumn({
  pondName,
  color,
  charts,
  metrics,
  pickSeries,
  grouping,
}: SideBySideColumnProps) {
  return (
    <div className="rounded-lg border-2 bg-white p-4" style={{ borderColor: color }}>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
        {pondName}
      </p>
      <div className="space-y-3">
        {charts.map((chart) => {
          const data = chart.data.map((point) => ({
            label: point.label,
            seriesA: pickSeries === "A" ? point.seriesA : point.seriesB,
          }));
          const metric = metrics.find((item) => item.parameter === chart.parameter);
          const noReadings = metric
            ? pickSeries === "A"
              ? !metric.pondAHasReadings
              : !metric.pondBHasReadings
            : false;
          return (
            <ComparisonChart
              key={chart.parameter}
              variant={chart.variant}
              title={chart.title}
              unit={chart.unit}
              watchedBy={metric?.watchedBy}
              badge={badgeFromGrouping(grouping)}
              data={data}
              seriesALabel={pondName}
              seriesBLabel=""
              seriesANoReadings={noReadings}
              themeColor={color}
              colorA={color}
            />
          );
        })}
      </div>
    </div>
  );
}
