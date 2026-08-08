import { useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { PageContainer } from "../components/layout/PageContainer";
import { ConsumptionByPeriodTable } from "../components/energy/ConsumptionByPeriodTable";
import { ConsumptionTrendChart } from "../components/energy/ConsumptionTrendChart";
import { EnergyFilters } from "../components/energy/EnergyFilters";
import { HourlyHeatmap } from "../components/energy/HourlyHeatmap";
import { KpiCards } from "../components/energy/KpiCards";
import type {
  CompareMode,
  EnergyDashboardData,
  GroupBy,
  QuickRange,
} from "../components/energy/types";
import { apiService } from "../services/api.service";
import { getCurrentProjectId } from "../utils/auth";

const GROUP_FOR: Record<QuickRange, GroupBy> = {
  today: "hour",
  "7d": "day",
  "30d": "day",
  "90d": "week",
  custom: "day",
};

function rangeFor(quick: QuickRange): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  const span = quick === "today" ? 0 : quick === "30d" ? 29 : quick === "90d" ? 89 : 6;
  start.setDate(end.getDate() - span);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

function autoGroupFor(startDate: string, endDate: string): GroupBy {
  const days =
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000 +
    1;
  if (days <= 2) return "hour";
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

export function EnergyConsumptionPage() {
  const projectId = getCurrentProjectId();
  const [quick, setQuick] = useState<QuickRange>("7d");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [range, setRange] = useState(() => rangeFor("7d"));
  const [compare, setCompare] = useState<CompareMode>("previous");
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<EnergyDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = range;

  const handleQuickChange = (q: QuickRange) => {
    setQuick(q);
    setRange(rangeFor(q));
    setGroupBy(GROUP_FOR[q]);
  };

  const handleRangeChange = (start: string, end: string) => {
    setQuick("custom");
    setRange({ startDate: start, endDate: end });
    setGroupBy(autoGroupFor(start, end));
  };

  const handleExport = async () => {
    if (!projectId || exporting) return;
    setExporting(true);
    try {
      const { blob, filename } = await apiService.downloadEnergyExport({
        projectId,
        startDate,
        endDate,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert("Failed to export energy data.");
    } finally {
      setExporting(false);
    }
  };

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Energy Consumption</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track and analyze total electricity consumption for the project over time.
          </p>
        </div>

        <EnergyFilters
          dateRangeLabel={data?.dateRangeLabel ?? "-"}
          quick={quick}
          onQuickChange={handleQuickChange}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          startDate={startDate}
          endDate={endDate}
          onRangeChange={handleRangeChange}
          compare={compare}
          onCompareChange={setCompare}
          previousRangeLabel={data?.compareInfo.previousRange}
          onExport={handleExport}
          exporting={exporting}
        />

        {!projectId ? (
          <EmptyState message="Select a project to view energy consumption." />
        ) : loading ? (
          <EmptyState message="Loading energy data..." />
        ) : error ? (
          <EmptyState message={error} />
        ) : data ? (
          <>
            <KpiCards kpis={data.kpis} showCompare={compare === "previous"} />

            <ConsumptionTrendChart
              data={data.trend}
              currentLabel={data.trendCurrentLabel}
              previousLabel={data.trendPreviousLabel}
              showPrevious={compare === "previous"}
              compareInfo={data.compareInfo}
            />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <ConsumptionByPeriodTable
                title={data.byPeriod.title}
                rows={data.byPeriod.rows}
              />
              <HourlyHeatmap data={data.heatmap} />
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
