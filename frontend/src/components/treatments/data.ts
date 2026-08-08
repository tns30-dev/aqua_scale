// Shared constants + pure helpers for the Treatment Stability page
// (treatment_stability.md). Wired to the real APIs on 28 Jul 2026 — the
// frozen prototype numbers (PARAMS/OVERALL/POWER/CATALOG/COURSES/PONDS)
// are gone; measured data comes from /api/pond-treatments/stability/.

export const C = {
  good: "#0ca30c",
  goodInk: "#047a04",
  bad: "#d03b3b",
  muted: "#898781",
  grid: "#e5e4de",
  track: "#efeeea",
  theme: "#EA580C",
} as const;

export interface StabRow {
  name: string;
  pct: number;
  safe: number;
  total: number;
}

// The product catalogue row as the page uses it (Treatment on the wire:
// target_parameters are parameter_types codes). priceUnit decides which
// dose units a course may use: kg → g/kg, l → ml/l.
export interface CatalogItem {
  id: string;
  name: string;
  targets: string[];
  active: boolean;
  price: number; // per 1 priceUnit; 0 = not set
  priceUnit: "kg" | "l";
}

export const DOSE_UNITS: Record<"kg" | "l", string[]> = {
  kg: ["g", "kg"],
  l: ["ml", "l"],
};

// Display-order hint + label fallback for parameter codes. The pickable
// chips themselves come from the PROJECT's configured parameters
// (/api/projects/{id}/parameters/, owner call 28 Jul) — this list only
// orders the common ones first and labels codes the project no longer
// configures (e.g. on old declarations).
export const PARAM_VOCAB: { code: string; label: string }[] = [
  { code: "ammonia", label: "Ammonia" },
  { code: "dissolved_oxygen", label: "Dissolved O2" },
  { code: "turbidity", label: "Turbidity" },
  { code: "ph", label: "pH" },
  { code: "alkalinity", label: "Alkalinity" },
  { code: "nitrite", label: "Nitrite" },
  { code: "nitrate", label: "Nitrate" },
  { code: "salinity", label: "Salinity" },
  { code: "temperature", label: "Temperature" },
  { code: "total_hardness", label: "Total Hardness" },
];

export const paramLabel = (code: string | undefined): string =>
  !code
    ? ""
    : PARAM_VOCAB.find((p) => p.code === code)?.label ??
      code.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());

export interface ParamOption {
  code: string;
  label: string;
}

// Common parameters first (PARAM_VOCAB order), the rest alphabetical.
export function sortParamOptions(options: ParamOption[]): ParamOption[] {
  const rank = (code: string) => {
    const i = PARAM_VOCAB.findIndex((p) => p.code === code);
    return i === -1 ? PARAM_VOCAB.length : i;
  };
  return [...options].sort(
    (a, b) => rank(a.code) - rank(b.code) || a.label.localeCompare(b.label),
  );
}

export interface Course {
  id: string;
  treatmentId: string;
  name: string;
  start: string; // ISO yyyy-mm-dd
  end?: string; // ISO yyyy-mm-dd · absent = ongoing
  amount?: number; // total used across the course, in `unit`
  unit?: string; // g | kg | ml | l
}

export const isOngoing = (c: Course) => !c.end;

export const doseLabel = (c: Course): string | null =>
  c.amount != null && c.unit ? `${c.amount} ${c.unit}` : null;

const day = (iso: string) => new Date(`${iso}T00:00:00`);
const fmtShort = (iso: string) =>
  day(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const yr = (iso: string) => iso.slice(0, 4);

// The year is always shown (owner, 29 Jul): once at the end when the range
// stays in one year, on both sides when it crosses.
export function courseRange(c: Course, todayIso: string): string {
  void todayIso;
  if (!c.end) return `${fmtShort(c.start)} ${yr(c.start)} → today`;
  if (yr(c.start) === yr(c.end)) return `${fmtShort(c.start)} → ${fmtShort(c.end)} ${yr(c.end)}`;
  return `${fmtShort(c.start)} ${yr(c.start)} → ${fmtShort(c.end)} ${yr(c.end)}`;
}

export function courseDays(c: Course, todayIso: string): number {
  const end = c.end ?? todayIso;
  return Math.max(1, Math.round((day(end).getTime() - day(c.start).getTime()) / 86_400_000) + (c.end ? 1 : 0));
}

// Window rule C (treatment_stability.md, decided 27 Jul 2026): the stretch
// when EVERY selected course was in the water at once — latest start to
// earliest end (ongoing = today). Null when they never ran together.
export function overlapWindow(
  courses: Course[],
  todayIso: string,
): { start: string; end: string } | null {
  if (courses.length === 0) return null;
  const start = courses.map((c) => c.start).sort().at(-1)!;
  const end = courses.map((c) => c.end ?? todayIso).sort()[0];
  return end < start ? null : { start, end };
}

export function windowLabel(w: { start: string; end: string }, todayIso: string): string {
  if (w.end === todayIso) return `${fmtShort(w.start)} ${yr(w.start)} → today`;
  if (yr(w.start) === yr(w.end)) return `${fmtShort(w.start)} → ${fmtShort(w.end)} ${yr(w.end)}`;
  return `${fmtShort(w.start)} ${yr(w.start)} → ${fmtShort(w.end)} ${yr(w.end)}`;
}

export const windowDays = (w: { start: string; end: string }, todayIso: string): number =>
  courseDays(
    { id: "", treatmentId: "", name: "", start: w.start, end: w.end === todayIso ? undefined : w.end },
    todayIso,
  );

export function hexA(h: string, a: number): string {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Stability status bands: 75% and above is good, 50 to 74 needs watching,
// below 50 is bad.
export const stabColor = (pct: number) => (pct >= 75 ? C.good : pct >= 50 ? "#f59e0b" : C.bad);
export const stabInk = (pct: number) => (pct >= 75 ? C.goodInk : pct >= 50 ? "#b45309" : C.bad);
