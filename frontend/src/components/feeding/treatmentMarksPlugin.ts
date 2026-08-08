import type { ChartType, Plugin } from "chart.js";
import type { FeedingTreatment } from "./types";

// Categorical treatment palette — 10 pure colors, validated 23 Jul 2026
// (light surface, adjacent-in-assignment-order pairs: worst CVD ΔE 10.1
// deutan, worst normal 19.8, all ≥ 3:1 contrast; identity is also carried
// by the legend). Slots are assigned in fixed order across BOTH compared
// cycles — every course gets its own color (owner decision: the same
// treatment on two cycles must NOT share a color). The old theme-clash
// filter is GONE (owner, 23 Jul: "no need to care with theme choice") —
// it silently reshuffled the palette per profile and made co-occurring
// colors collide; without it the validated order is the rendered order.
export const TREATMENT_PALETTE = [
  "#7C3AED", "#EA580C", "#0D9488", "#B91C1C", "#0284C7",
  "#92400E", "#DB2777", "#A16207", "#1D4ED8", "#65A30D",
];

export interface DecoratedTreatment extends FeedingTreatment {
  color: string;
}

declare module "chart.js" {
  // TType must keep this exact name/constraint to merge with Chart.js's own
  // PluginOptionsByType declaration (TS2428); it is unused in this augmentation.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    treatmentMarks?: { items: DecoratedTreatment[] };
  }
}

export function treatmentDayRange(t: FeedingTreatment): string {
  if (t.startedBefore) return t.endDay != null ? `pre-cycle – D${t.endDay}` : "pre-cycle – ongoing";
  if (t.ongoing || t.endDay == null) return `D${t.startDay} – ongoing`;
  return `D${t.startDay} – D${t.endDay}`;
}

/**
 * ONE deterministic color assignment for a dashboard load: the base
 * cycle's treatments (sorted by code) take palette slots first and the
 * compared cycle's continue from there — so no two courses share a color,
 * in any view mode.
 */
export function assignTreatmentColors(
  base: FeedingTreatment[],
  cmp: FeedingTreatment[],
): { base: DecoratedTreatment[]; cmp: DecoratedTreatment[] } {
  const palette = TREATMENT_PALETTE;
  let slot = 0;
  const decorate = (treatments: FeedingTreatment[]): DecoratedTreatment[] => {
    const ordered = [...treatments].sort((a, b) => a.startDay - b.startDay);
    const byCode = new Map<string, string>();
    [...new Set(ordered.map((t) => t.code))].sort().forEach((code) => {
      byCode.set(code, palette[slot++ % palette.length]);
    });
    return ordered.map((t) => ({ ...t, color: byCode.get(t.code) ?? TREATMENT_PALETTE[0] }));
  };
  return { base: decorate(base), cmp: decorate(cmp) };
}

/**
 * Dotted vertical marks crossing the plot: one at a treatment's start day
 * and one at its end day (none when ongoing / past the axis). The dotted
 * style is reserved for treatments — the data series stay the only solid
 * lines — and the legend carries name + day range, so the marks themselves
 * are label-free.
 *
 * Items are read from `options.plugins.treatmentMarks.items` (NOT captured
 * in a closure): react-chartjs-2 only applies inline plugins at chart
 * creation, so closure data goes stale — options are updated every render.
 */
export const treatmentMarksPlugin: Plugin<"bar" | "line"> = {
  id: "treatmentMarks",
  afterDatasetsDraw(chart) {
    const items = chart.options.plugins?.treatmentMarks?.items ?? [];
    if (!items.length) return;
    const x = chart.scales.x;
    const area = chart.chartArea;
    if (!x || !area) return;

    // Marks sharing a day would overdraw each other (last color wins), so
    // they interleave instead: the dash period grows with the number of
    // marks on the day and each mark's dots are phase-shifted into the
    // gaps — one vertical, all colors visible. n = 1 collapses to [2, 3].
    // A mark = a treatment EVENT inside this cycle: no start mark for a
    // pre-cycle course (it did not start here), no end mark while ongoing.
    const byDay = new Map<number, string[]>();
    items.forEach((t) => {
      const days: number[] = [];
      if (!t.startedBefore && typeof t.startDay === "number") days.push(t.startDay);
      if (typeof t.endDay === "number") days.push(t.endDay);
      days.forEach((day) => {
        byDay.set(day, [
          ...(byDay.get(day) ?? []),
          typeof t.color === "string" ? t.color : TREATMENT_PALETTE[0],
        ]);
      });
    });

    const ctx = chart.ctx;
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    byDay.forEach((colors, day) => {
      const px = x.getPixelForValue(day - 1);
      if (px < area.left || px > area.right) return;
      colors.forEach((color, i) => {
        ctx.strokeStyle = color;
        ctx.setLineDash([2, 5 * colors.length - 2]);
        ctx.lineDashOffset = -5 * i;
        ctx.beginPath();
        ctx.moveTo(px, area.top);
        ctx.lineTo(px, area.bottom);
        ctx.stroke();
      });
    });
    ctx.restore();
  },
};
