import type { CycleTemplate } from "./types";

/**
 * Key for letter-collapsed stage names ("P Pre-stocking · E Early Growth…").
 * Rendered only while the chart is narrow enough that at least one stage
 * label collapsed to its first letter — mobile has no hover to expand them.
 */
export function StageKeyRow({ template, collapsed }: { template: CycleTemplate; collapsed: number[] }) {
  if (!collapsed.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
      {collapsed.map((index) => {
        const stage = template.stages[index];
        if (!stage) return null;
        return (
          <span key={stage.name} className="flex items-center gap-1">
            <span className="font-bold" style={{ color: stage.color }}>
              {stage.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-gray-500">{stage.name}</span>
          </span>
        );
      })}
    </div>
  );
}
