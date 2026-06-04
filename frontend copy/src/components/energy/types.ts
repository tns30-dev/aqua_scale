/**
 * Local types for the Energy Consumption page.
 *
 * These mirror the `/api/projects/{id}/energy/dashboard` response
 * (EnergyDashboardData) consumed by the page's components.
 */

export type GroupBy = "hour" | "day" | "week" | "month";
export type QuickRange = "today" | "7d" | "30d" | "90d" | "custom";

export interface EnergyKpis {
  totalKwh: number;
  estimatedCost: number;
  tariffPerKwh: number;
  currencySymbol: string;
  avgKwhPerDay: number;
  avgKwhPerHour: number;
  peakHourKwh: number;
  peakHourLabel: string;
  /** % change vs previous period; negative = lower (improvement). */
  changeVsPreviousPct: number;
  /** Absolute cost change vs previous period (currency units). */
  costChange: number;
  compareLabel: string;
}

export interface TrendPoint {
  label: string;
  current: number;
  previous: number;
}

export interface HeatmapData {
  dateLabels: string[];
  hourLabels: string[];
  /** rows = hours, cols = dates; null = No Data (never rendered as 0). */
  matrix: (number | null)[][];
  maxValue: number;
}

export interface SummaryRow {
  metric: string;
  current: string;
  previous: string;
  /** e.g. "18.2% lower" or "$54.32 lower". */
  change: string;
  /** true when the change is an improvement (lower usage/cost). */
  improved: boolean;
}

export interface ByPeriodRow {
  label: string;
  kwh: number;
}

export interface EnergyAlert {
  title: string;
  when: string;
  value: string;
}

export interface DataQuality {
  completenessPct: number;
  availableRecords: number;
  expectedRecords: number;
  missingHours: number;
  missingPct: number;
  lastReceived: string;
  source: string;
}

export interface CompareInfo {
  currentRange: string;
  previousRange: string;
}

export interface EnergyDashboardData {
  lastUpdated: string;
  dateRangeLabel: string;
  kpis: EnergyKpis;
  trend: TrendPoint[];
  trendCurrentLabel: string;
  trendPreviousLabel: string;
  heatmap: HeatmapData;
  summary: SummaryRow[];
  byPeriod: { title: string; rows: ByPeriodRow[] };
  alerts: EnergyAlert[];
  dataQuality: DataQuality;
  compareInfo: CompareInfo;
}
