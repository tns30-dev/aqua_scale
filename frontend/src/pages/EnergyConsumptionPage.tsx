import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { PageContainer } from "../components/layout/PageContainer";
import { EnergyFilters } from "../components/energy/EnergyFilters";
import { KpiCards } from "../components/energy/KpiCards";
import { ConsumptionTrendChart } from "../components/energy/ConsumptionTrendChart";
import { HourlyHeatmap } from "../components/energy/HourlyHeatmap";
import { ConsumptionSummaryTable } from "../components/energy/ConsumptionSummaryTable";
import { ConsumptionByPeriodTable } from "../components/energy/ConsumptionByPeriodTable";
import { HighConsumptionAlerts } from "../components/energy/HighConsumptionAlerts";
import type { EnergyDashboardData, GroupBy, QuickRange } from "../components/energy/types";
import { apiService } from "../services/api.service";
import { getCurrentProjectId } from "../utils/auth";

/** Quick-range → [startDate, endDate] (YYYY-MM-DD, local time). */
function rangeFor(quick: QuickRange): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  const span = quick === "today" ? 0 : quick === "30d" ? 29 : quick === "90d" ? 89 : 6;
  start.setDate(end.getDate() - span);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

/**
 * Energy Consumption — project-level electricity dashboard.
 *
 * Reads the computed dashboard from
 * GET /api/projects/{id}/energy/dashboard (module_project). Quick Range +
 * Group By drive the query; the components are unchanged from the wireframe —
 * only the data source moved from mock to API.
 */
export function EnergyConsumptionPage() {
  const projectId = getCurrentProjectId();
  const [quick, setQuick] = useState<QuickRange>("7d");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [data, setData] = useState<EnergyDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(() => rangeFor(quick), [quick]);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiService
      .getEnergyDashboard({ projectId, startDate, endDate, groupBy })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load energy data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, startDate, endDate, groupBy]);

  return (
    <AppShell>
      <PageContainer className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Energy Consumption</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track and analyze total electricity consumption for the project over time.
          </p>
        </div>

        {/* Filters */}
        <EnergyFilters
          dateRangeLabel={data?.dateRangeLabel ?? "—"}
          quick={quick}
          onQuickChange={setQuick}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
        />

        {!projectId ? (
          <EmptyState message="Select a project to view energy consumption." />
        ) : loading ? (
          <EmptyState message="Loading energy data…" />
        ) : error ? (
          <EmptyState message={error} />
        ) : data ? (
          <>
            {/* KPI cards */}
            <KpiCards kpis={data.kpis} />

            {/* Charts */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <ConsumptionTrendChart
                data={data.trend}
                currentLabel={data.trendCurrentLabel}
                previousLabel={data.trendPreviousLabel}
              />
              <HourlyHeatmap data={data.heatmap} />
            </div>

            {/* Summary / By-period / Alerts */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <ConsumptionSummaryTable rows={data.summary} />
              </div>
              <div className="lg:col-span-3">
                <ConsumptionByPeriodTable title={data.byPeriod.title} rows={data.byPeriod.rows} />
              </div>
              <div className="lg:col-span-4">
                <HighConsumptionAlerts alerts={data.alerts} />
              </div>
            </div>
          </>
        ) : null}
      </PageContainer>
    </AppShell>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white text-sm text-gray-500">
      {message}
    </div>
  );
}
