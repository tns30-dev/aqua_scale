import type { Plugin } from "chart.js";

export function endLabelsPlugin(): Plugin<"bar" | "line"> {
  return {
    id: "endLabels",
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      const labels: { x: number; ptY: number; y: number; text: string; color: string }[] = [];
      chart.data.datasets.forEach((ds, i) => {
        const meta = chart.getDatasetMeta(i);
        if (meta.hidden || !meta.data.length) return;
        const data = ds.data as (number | null)[];
        let idx = data.length - 1;
        while (idx >= 0 && data[idx] == null) idx--;
        if (idx < 0) return;
        const v = data[idx] as number;
        const pt = meta.data[idx] as unknown as { x: number; y: number };
        labels.push({ x: pt.x, ptY: pt.y, y: pt.y, text: `${v.toFixed(1)} kg`, color: String(ds.borderColor) });
      });
      labels.sort((a, b) => a.y - b.y);
      for (let i = 1; i < labels.length; i++) {
        if (labels[i].y - labels[i - 1].y < 13) labels[i].y = labels[i - 1].y + 13;
      }
      labels.forEach((l) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(l.x, l.ptY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = l.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.font = "700 10px -apple-system, sans-serif";
        ctx.fillStyle = "#334155";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(l.text, l.x + 8, l.y);
        ctx.restore();
      });
    },
  };
}
