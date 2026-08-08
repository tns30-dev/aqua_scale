import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { PageContainer } from "../components/layout/PageContainer";
import { ComparisonChart } from "../components/charts/ComparisonChart";
import { useProfileTheme, useProfile } from "../context/ProfileContext";
import { MetricCard } from "../components/ab-testing/MetricCard";
import { calculateChange } from "../utils/abTesting";
import { ComparisonConfig } from "../components/ab-testing/ComparisonConfig";
import { getComparisonColors } from "../utils/profileColors";
import { useSession } from "../context/SessionContext";
import { apiService } from "../services/api.service";
import { getCurrentProjectId } from "../utils/auth";
import type {
  PondComparisonChart,
  PondComparisonPondOption,
  PondComparisonResponse,
} from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTreatmentDate(iso: string): string {
  // "2026-03-01" → "Mar 1, 2026"
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function badgeFromGrouping(g: PondComparisonResponse["dateRange"]["grouping"]): string {
  return g.charAt(0).toUpperCase() + g.slice(1);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ABTestingPage() {
  const theme = useProfileTheme();
  const { currentProfile } = useProfile();
  const comparisonColors = getComparisonColors(currentProfile);

  // Project selection comes from the top-right ProfileDropdown (writes to
  // localStorage; ProfileContext.currentProfile is the reactive signal).
  // We depend on `currentProfile` so the page re-renders on switch — then
  // re-read currentProjectId from localStorage.
  const { projects } = useSession();
  // currentProfile is read so this component subscribes to profile switches —
  // the value itself isn't used directly here.
  void currentProfile;
  const projectId = getCurrentProjectId();
  const project = useMemo(
    () => projects.find((p) => p.projectId === projectId) ?? null,
    [projects, projectId],
  );

  // Options (page load)
  const [options, setOptions] = useState<PondComparisonPondOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // Draft (what the user is editing)
  const [draftPondAId, setDraftPondAId] = useState<string>("");
  const [draftPondBId, setDraftPondBId] = useState<string>("");
  const [draftFromDate, setDraftFromDate] = useState<string>(isoDaysAgo(30));
  const [draftToDate, setDraftToDate] = useState<string>(todayIso());

  // Applied (what's rendered)
  const [comparison, setComparison] = useState<PondComparisonResponse | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Chart view toggle (pure UI state)
  const [chartViewMode, setChartViewMode] = useState<"stacked" | "side-by-side">("stacked");

  // ── Load options when the project changes ─────────────────────────────────
  useEffect(() => {
    if (!projectId) {
      setOptions([]);
      setComparison(null);
      return;
    }
    let cancelled = false;
    // Reset comparison so we don't show stale data from a previous project.
    setComparison(null);
    setApplyError(null);
    setOptionsLoading(true);
    setOptionsError(null);
    apiService
      .getPondComparisonOptions(projectId)
      .then((resp) => {
        if (cancelled) return;
        setOptions(resp.ponds);
        const withData = resp.ponds.filter((p) => p.hasSensorData);
        if (withData.length >= 2) {
          setDraftPondAId(withData[0].pondId);
          setDraftPondBId(withData[1].pondId);
        } else if (resp.ponds.length >= 2) {
          setDraftPondAId(resp.ponds[0].pondId);
          setDraftPondBId(resp.ponds[1].pondId);
        } else {
          setDraftPondAId("");
          setDraftPondBId("");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setOptionsError(err?.response?.data?.detail ?? err?.message ?? "Failed to load ponds");
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // ── Apply ────────────────────────────────────────────────────────────────
  const handleApply = useCallback(async () => {
    if (!projectId || !draftPondAId || !draftPondBId) return;
    if (draftPondAId === draftPondBId) {
      setApplyError("Pond A and Pond B must differ");
      return;
    }
    if (!draftFromDate || !draftToDate) {
      setApplyError("Pick a date range");
      return;
    }
    if (draftToDate < draftFromDate) {
      setApplyError("End date must be on or after start date");
      return;
    }
    setApplyLoading(true);
    setApplyError(null);
    try {
      const data = await apiService.getPondComparison({
        projectId,
        pondAId: draftPondAId,
        pondBId: draftPondBId,
        startDate: draftFromDate,
        endDate: draftToDate,
      });
      setComparison(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setApplyError(e?.response?.data?.detail ?? e?.message ?? "Failed to load comparison");
    } finally {
      setApplyLoading(false);
    }
  }, [projectId, draftPondAId, draftPondBId, draftFromDate, draftToDate]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const draftPondA = useMemo(
    () => options.find((p) => p.pondId === draftPondAId),
    [options, draftPondAId],
  );
  const draftPondB = useMemo(
    () => options.find((p) => p.pondId === draftPondBId),
    [options, draftPondBId],
  );

  // ── Early returns ────────────────────────────────────────────────────────
  if (projects.length === 0) {
    return (
      <AppShell>
        <PageContainer>
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
            No project assigned to your account. Contact a platform admin to grant project access.
          </div>
        </PageContainer>
      </AppShell>
    );
  }
  if (!projectId || !project) {
    return (
      <AppShell>
        <PageContainer>
          <div className="mb-1 text-[22px] font-bold text-[#0F2B3C]">Pond Comparison</div>
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
            Pick a project from the dropdown at the top right to start comparing ponds.
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer>
        <div className="mb-1 text-[22px] font-bold text-[#0F2B3C]">Pond Comparison</div>
        <div className="mb-5 text-xs text-gray-500">
          Compare two ponds side-by-side across the same date range
        </div>

        {optionsError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {optionsError}
          </div>
        )}

        {/* Configuration bar */}
        <ComparisonConfig
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
          themeColor={theme.primary}
          colorA={comparisonColors.pondA}
          colorB={comparisonColors.pondB}
        />

        {applyError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {applyError}
          </div>
        )}
        {applyLoading && (
          <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Loading comparison…
          </div>
        )}

        {/* Pond A & Pond B detail cards + metric grid */}
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <PondPanel
            sideLabel="Pond A"
            pond={draftPondA}
            color={comparisonColors.pondA}
            metrics={comparison?.metrics ?? []}
            getValue={(m) => m.pondAValue}
            getChangeText={(m) =>
              calculateChange(m.pondAValue, m.pondBValue, m.lowerIsBetter, m.unit).text
            }
            getChangeType={(m) =>
              calculateChange(m.pondAValue, m.pondBValue, m.lowerIsBetter, m.unit).type
            }
            pondName={comparison?.pondA.name ?? draftPondA?.name ?? "Pond A"}
          />
          <PondPanel
            sideLabel="Pond B"
            pond={draftPondB}
            color={comparisonColors.pondB}
            metrics={comparison?.metrics ?? []}
            getValue={(m) => m.pondBValue}
            getChangeText={() => ""}
            getChangeType={() => "neutral"}
            pondName={comparison?.pondB.name ?? draftPondB?.name ?? "Pond B"}
          />
        </div>

        {/* Chart View Toggle */}
        <div className="mt-5 mb-3 flex items-center gap-2">
          <button
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
            onClick={() => setChartViewMode("side-by-side")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              chartViewMode === "side-by-side"
                ? "bg-gray-500 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            Side-by-Side
          </button>
        </div>

        {/* Charts */}
        {comparison ? (
          chartViewMode === "stacked" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {comparison.charts.map((c) => (
                <ComparisonChart
                  key={c.parameter}
                  variant={c.variant}
                  title={`${c.title} (${c.unit})`}
                  badge={badgeFromGrouping(comparison.dateRange.grouping)}
                  data={c.data}
                  seriesALabel={comparison.pondA.name}
                  seriesBLabel={comparison.pondB.name}
                  themeColor={theme.primary}
                  colorA={comparisonColors.pondA}
                  colorB={comparisonColors.pondB}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SideBySideColumn
                pondName={comparison.pondA.name}
                color={comparisonColors.pondA}
                charts={comparison.charts}
                pickSeries="A"
                grouping={comparison.dateRange.grouping}
              />
              <SideBySideColumn
                pondName={comparison.pondB.name}
                color={comparisonColors.pondB}
                charts={comparison.charts}
                pickSeries="B"
                grouping={comparison.dateRange.grouping}
              />
            </div>
          )
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            {optionsLoading
              ? "Loading ponds…"
              : options.length < 2
              ? "Need at least 2 ponds in this project to compare."
              : "Pick two ponds and a date range, then click Apply."}
          </div>
        )}
      </PageContainer>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PondPanelProps {
  sideLabel: string;
  pond: PondComparisonPondOption | undefined;
  color: string;
  metrics: PondComparisonResponse["metrics"];
  getValue: (m: PondComparisonResponse["metrics"][number]) => number;
  getChangeText: (m: PondComparisonResponse["metrics"][number]) => string;
  getChangeType: (m: PondComparisonResponse["metrics"][number]) => "positive" | "warning" | "neutral";
  pondName: string;
}

function PondPanel({
  sideLabel,
  pond,
  color,
  metrics,
  getValue,
  getChangeText,
  getChangeType,
  pondName,
}: PondPanelProps) {
  // Active treatments — sorted DESC by startedAt; row omitted entirely when empty.
  const sortedTreatments = useMemo(
    () =>
      pond
        ? [...(pond.treatments ?? [])].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        : [],
    [pond],
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      {pond && (
        <div
          className="mb-3 rounded-lg border p-3"
          style={{
            backgroundColor: `${color}10`,
            borderColor: `${color}30`,
            borderLeftWidth: 3,
            borderLeftColor: color,
          }}
        >
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
            {sideLabel}: {pond.name}
          </p>
          <div className="mt-2 grid grid-cols-1 gap-x-4 text-xs text-gray-600 md:grid-cols-2">
            {/* Left: identity */}
            <div className="space-y-1">
              <p>
                GPS: <span className="font-medium text-gray-800">{pond.gpsLocation || "—"}</span>
              </p>
            </div>
            {/* Right: treatments (only rendered when present, per Open Q B) */}
            {sortedTreatments.length > 0 && (
              <div className="mt-2 md:mt-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Treatments
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {sortedTreatments.map((t) => (
                    <li key={t.code} className="text-gray-800">
                      <span className="font-medium">{t.name}</span> — since {formatTreatmentDate(t.startedAt)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        {metrics.length > 0
          ? metrics.map((m) => (
              <MetricCard
                key={`${sideLabel}-${m.parameter}`}
                label={m.label}
                pondName={pondName}
                value={getValue(m)}
                unit={m.unit}
                changeText={getChangeText(m)}
                changeType={getChangeType(m)}
                themeColor={color}
              />
            ))
          : Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`placeholder-${i}`}
                className="rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-[10px] text-gray-400"
              >
                —
              </div>
            ))}
      </div>
    </div>
  );
}

interface SideBySideColumnProps {
  pondName: string;
  color: string;
  charts: PondComparisonChart[];
  pickSeries: "A" | "B";
  grouping: PondComparisonResponse["dateRange"]["grouping"];
}

function SideBySideColumn({ pondName, color, charts, pickSeries, grouping }: SideBySideColumnProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
        {pondName}
      </p>
      <div className="space-y-3">
        {charts.map((c) => {
          // Project the shared bucket grid into a single-series payload.
          // No seriesB key at all → ComparisonChart renders Pond A line only.
          const data = c.data.map((p) => ({
            label: p.label,
            seriesA: pickSeries === "A" ? p.seriesA : p.seriesB,
          }));
          return (
            <ComparisonChart
              key={c.parameter}
              variant={c.variant}
              title={`${c.title} (${c.unit})`}
              badge={badgeFromGrouping(grouping)}
              data={data}
              seriesALabel={pondName}
              seriesBLabel=""
              themeColor={color}
              colorA={color}
            />
          );
        })}
      </div>
    </div>
  );
}
