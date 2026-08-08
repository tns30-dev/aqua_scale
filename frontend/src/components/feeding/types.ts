export interface Stage {
  name: string;
  startDay: number;
  endDay: number;
  color: string;
}

export interface CycleTemplate {
  lengthDays: number;
  stages: Stage[];
}

export interface FeedingCycleOption {
  cycleId: string;
  displayName: string;
  startDate: string;
  endDate: string | null;
  status: string;
  elapsedDays: number;
  feedKg: number;
  cost: number;
  fcr: number | null;
  biomassGainKg: number | null;
}

export interface FeedingPondOption {
  pondId: string;
  name: string;
  cycles: FeedingCycleOption[];
}

export interface FeedingFeedType {
  feedTypeId: string;
  name: string;
  packKg: number;
  packPrice: number;
  currency: string;
  unitPrice: number;
}

export interface FeedingOptionsResponse {
  projectId: string;
  ponds: FeedingPondOption[];
  feedTypes: FeedingFeedType[];
}

// Raw /api/feed-types/ record (snake_case like the other router
// endpoints; decimals arrive as strings).
export interface FeedTypeRecord {
  feed_type_id: string;
  project: string;
  name: string;
  pack_kg: string | number;
  pack_price: string | number;
  currency: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeedingCycleInfo {
  cycleId: string;
  pondId: string;
  displayName: string;
  startDate: string;
  endDate: string | null;
  status: string;
  elapsedDays: number;
  stockingBiomassKg: number | null;
  harvestBiomassKg: number | null;
}

export interface FeedingKpis {
  feedKg: number;
  cost: number;
  avgKgPerDay: number;
  biomassGainKg: number | null;
  fcr: number | null;
}

export interface FeedingKpiChanges {
  feedPct: number | null;
  costPct: number | null;
  avgPct: number | null;
  gainPct: number | null;
  fcrDiff: number | null;
}

export interface FeedingDayEntry {
  feedLogId: string;
  feedTypeId: string;
  feedTypeName: string;
  amountKg: number;
  packKg: number;
  packPrice: number;
  cost: number;
  fedTime: string | null;
}

export interface FeedingDay {
  day: number;
  date: string;
  totalKg: number;
  cost: number;
  entries: FeedingDayEntry[];
}

export interface FeedingStageSummary {
  stage: string;
  feedKg: number | null;
  cost: number | null;
  avgKgPerDay: number | null;
  missedDays: number;
  changePct: number | null;
}

export interface FeedingTreatment {
  pondTreatmentId: string;
  name: string;
  code: string;
  startDay: number;
  endDay: number | null;
  startDate: string;
  endDate: string | null;
  ongoing: boolean;
  startedBefore: boolean;
  notes: string | null;
}

export interface FeedingDashboardResponse {
  template: CycleTemplate;
  cycle: FeedingCycleInfo;
  compare: FeedingCycleInfo | null;
  horizonDays: number;
  kpis: {
    base: FeedingKpis;
    compare: FeedingKpis | null;
    changes: FeedingKpiChanges | null;
  };
  days: {
    base: FeedingDay[];
    compare: FeedingDay[] | null;
  };
  stageSummaries: {
    base: FeedingStageSummary[];
    compare: FeedingStageSummary[] | null;
  };
  treatments: {
    base: FeedingTreatment[];
    compare: FeedingTreatment[] | null;
  };
}

export interface FeedEntryWrite {
  feedLogId?: string;
  feedTypeId: string;
  amountKg: number;
  fedTime?: string | null;
}
