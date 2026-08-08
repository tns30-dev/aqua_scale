import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Zap } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageContainer } from "../components/layout/PageContainer";
import type { EnergyDashboardData } from "../types";
import { apiService } from "../services/api.service";
import { getCurrentProjectId } from "../utils/auth";

const UTILITIES: { id: string; path: string }[] = [
  { id: "electricity", path: "/energy/electricity" },
];

function weeklyRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1">
        <span className="text-lg font-bold text-gray-900">{value}</span>
        {unit && <span className="text-xs text-gray-400">{unit}</span>}
      </p>
    </div>
  );
}

function ElectricityCard({ data, openAlerts }: { data: EnergyDashboardData; openAlerts: number }) {
  const navigate = useNavigate();
  const { kpis } = data;

  return (
    <section
      onClick={() => navigate("/energy/electricity")}
      className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-5 transition hover:border-emerald-200 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50">
          <Zap className="h-5 w-5 text-emerald-600" />
        </div>
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-gray-900">Electricity</h3>
        <span
          className={
            openAlerts > 0
              ? "flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600"
              : "flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600"
          }
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {openAlerts} open alerts
        </span>
      </div>

      <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-gray-400">
        Last 7 days - {data.dateRangeLabel}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-3 border-t border-gray-100 pt-3">
        <Stat label="Total Electricity" value={kpis.totalKwh.toFixed(1)} unit="kWh" />
        <Stat label="Average kWh / Day" value={kpis.avgKwhPerDay.toFixed(1)} unit="kWh" />
        <Stat
          label="Estimated Cost"
          value={`${kpis.currencySymbol}${kpis.estimatedCost.toFixed(2)}`}
        />
      </div>

      <div className="mt-4 flex items-center justify-end border-t border-gray-100 pt-3">
        <span className="flex items-center gap-1 text-sm font-medium text-emerald-600 group-hover:text-emerald-700">
          More Info
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </section>
  );
}

export function EnergyHubPage() {
  if (UTILITIES.length === 1) {
    return <Navigate to={UTILITIES[0].path} replace />;
  }
  return <EnergyHubGrid />;
}

function EnergyHubGrid() {
  const projectId = getCurrentProjectId();
  const [data, setData] = useState<EnergyDashboardData | null>(null);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const { startDate, endDate } = weeklyRange();
    Promise.all([
      apiService.getEnergyDashboard({ projectId, startDate, endDate, groupBy: "day" }),
      apiService.getEnergyAlerts({ projectId }),
    ])
      .then(([dashboard, alerts]) => {
        if (cancelled) return;
        setData(dashboard);
        setOpenAlerts(alerts.alerts.length);
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
  }, [projectId]);

  return (
    <AppShell>
      <PageContainer className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Energy Consumption</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor utility consumption for the project. Select a utility for the full dashboard.
          </p>
        </div>

        {!projectId ? (
          <EmptyState message="Select a project to view energy consumption." />
        ) : loading ? (
          <EmptyState message="Loading energy data..." />
        ) : error ? (
          <EmptyState message={error} />
        ) : data ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <ElectricityCard data={data} openAlerts={openAlerts} />
          </div>
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
