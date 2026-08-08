import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type Plugin,
} from "chart.js";
import type { CycleTemplate } from "./types";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler);

export function hexA(h: string, a: number): string {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Height of the stage-name title strip above the plot. Charts that use this
// plugin must reserve it via layout.padding.top so the strip sits outside
// the plot — data is clipped to the chart area and can never cross a name.
export const STAGE_STRIP_H = 16;

interface LetterRect {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
}

export function stageBandsPlugin(
  template: CycleTemplate,
  onCollapsedChange?: (stageIndexes: number[]) => void,
): Plugin<"bar" | "line"> {
  // Deterministic label rule (owner decision): a name that fits its band is
  // drawn in full; a wider one collapses to its first letter, with the full
  // name shown in an on-canvas tooltip on hover OR tap (mobile has no
  // hover). The collapsed set is reported so the chart can render a key row.
  const hover = { rects: [] as LetterRect[], active: -1 };
  let lastReported = "";
  return {
    id: "stageBands",
    beforeDatasetsDraw(chart) {
      const x = chart.scales.x;
      const y = chart.scales.y;
      if (!x || !y) return;
      const n = chart.data.labels?.length ?? 0;
      if (!n) return;
      const ctx = chart.ctx;
      const stripTop = y.top - STAGE_STRIP_H;
      const half = n > 1 ? (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2 : (x.right - x.left) / 2;
      hover.rects = [];
      const collapsed: number[] = [];
      template.stages.forEach((st, stageIndex) => {
        const s = st.startDay;
        const e = Math.min(st.endDay, n);
        if (s > e) return;
        const from = Math.max(x.getPixelForValue(s - 1) - half, x.left);
        const to = Math.min(x.getPixelForValue(e - 1) + half, x.right);
        ctx.save();
        ctx.fillStyle = hexA(st.color, 0.06);
        ctx.fillRect(from, stripTop, to - from, y.bottom - stripTop);
        ctx.fillStyle = hexA(st.color, 0.7);
        ctx.font = "600 8px -apple-system, sans-serif";
        ctx.textAlign = "center";
        const name = st.name.toUpperCase();
        const cx = (from + to) / 2;
        const ty = stripTop + 11;
        if (ctx.measureText(name).width <= to - from - 6) {
          ctx.fillText(name, cx, ty);
        } else {
          ctx.font = "700 8px -apple-system, sans-serif";
          ctx.fillText(name.charAt(0), cx, ty);
          hover.rects.push({ x: cx - 8, y: stripTop, w: 16, h: STAGE_STRIP_H, name });
          collapsed.push(stageIndex);
        }
        ctx.restore();
      });
      const key = collapsed.join(",");
      if (onCollapsedChange && key !== lastReported) {
        lastReported = key;
        onCollapsedChange(collapsed);
      }
    },
    afterEvent(_chart, args) {
      if (!hover.rects.length && hover.active === -1) return;
      const ev = args.event;
      if (ev.x == null || ev.y == null) return;
      const px = ev.x;
      const py = ev.y;
      const hit = hover.rects.findIndex((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
      const prev = hover.active;
      if (ev.type === "click") {
        // Tap toggles (mobile); tapping the open letter or elsewhere closes.
        hover.active = hit === prev ? -1 : hit;
      } else if (ev.type === "mousemove") {
        hover.active = hit;
      } else {
        return;
      }
      if (hover.active !== prev) args.changed = true;
    },
    afterDraw(chart) {
      const r = hover.rects[hover.active];
      if (!r) return;
      const ctx = chart.ctx;
      const area = chart.chartArea;
      ctx.save();
      ctx.font = "600 9px -apple-system, sans-serif";
      const bw = ctx.measureText(r.name).width + 14;
      const bh = 18;
      let bx = r.x + r.w / 2 - bw / 2;
      bx = Math.min(Math.max(bx, area.left + 2), area.right - bw - 2);
      const by = area.top + 4;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(bx, by, bw, bh, 4);
      } else {
        ctx.rect(bx, by, bw, bh);
      }
      ctx.fillStyle = "rgba(15,23,42,0.9)";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(r.name, bx + bw / 2, by + bh / 2 + 0.5);
      ctx.restore();
    },
  };
}
