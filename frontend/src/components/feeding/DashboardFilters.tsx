import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { fmtRange } from "./format";
import type { FeedingPondOption } from "./types";

interface DashboardFiltersProps {
  ponds: FeedingPondOption[];
  pondId: string;
  cycleId: string;
  onPondChange: (pondId: string) => void;
  onCycleChange: (cycleId: string) => void;
}

export function DashboardFilters({ ponds, pondId, cycleId, onPondChange, onCycleChange }: DashboardFiltersProps) {
  const pond = ponds.find((p) => p.pondId === pondId);
  const cycles = pond ? pond.cycles.slice().reverse() : [];
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Scope</span>
        <Select value={pondId} onValueChange={onPondChange}>
          <SelectTrigger className="h-9 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ponds.map((p) => (
              <SelectItem key={p.pondId} value={p.pondId} className="text-xs">
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Cycle</span>
        <Select value={cycleId} onValueChange={onCycleChange}>
          <SelectTrigger className="h-9 w-auto min-w-56 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cycles.map((c) => {
              const n = (pond?.cycles.findIndex((x) => x.cycleId === c.cycleId) ?? 0) + 1;
              return (
                <SelectItem key={c.cycleId} value={c.cycleId} className="text-xs">
                  Cycle {n} ({fmtRange(c.startDate, c.endDate)})
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
