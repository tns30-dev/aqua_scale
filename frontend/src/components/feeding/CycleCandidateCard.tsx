import { clsx } from "clsx";
import { Check } from "lucide-react";
import { fmtRange } from "./format";
import type { FeedingCycleOption } from "./types";

interface CycleCandidateCardProps {
  cycle: FeedingCycleOption;
  name: string;
  same?: boolean;
  selected: boolean;
  onClick: () => void;
}

function Chip({ tone, children }: { tone: "same" | "done" | "ongoing"; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        "ml-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold align-middle",
        tone === "same" && "bg-blue-50 text-blue-700",
        tone === "done" && "bg-emerald-100 text-emerald-800",
        tone === "ongoing" && "bg-gray-100 text-gray-500",
      )}
    >
      {children}
    </span>
  );
}

export function CycleCandidateCard({ cycle, name, same, selected, onClick }: CycleCandidateCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "block rounded-xl border p-3 text-left transition",
        selected
          ? "border-teal-600 bg-teal-50 ring-2 ring-teal-600/25"
          : "border-gray-200 bg-white hover:border-teal-500 hover:shadow-sm",
      )}
    >
      <div className="flex items-center text-[13px] font-bold text-gray-900">
        {selected && <Check className="mr-1 h-3.5 w-3.5 text-teal-700" />}
        {name}
        {same && <Chip tone="same">same cycle</Chip>}
        {cycle.endDate ? <Chip tone="done">Completed</Chip> : <Chip tone="ongoing">Ongoing</Chip>}
      </div>
      <div className="mb-2 mt-0.5 text-[11px] text-gray-500">{fmtRange(cycle.startDate, cycle.endDate)}</div>
      <div className="flex gap-4 text-[10px] text-gray-500">
        <span>
          <b className="block text-[13px] text-teal-700">{cycle.feedKg} kg</b>feed
        </span>
        <span>
          <b className="block text-[13px] text-gray-900">{cycle.fcr != null ? cycle.fcr.toFixed(2) : "—"}</b>FCR
        </span>
        <span>
          <b className="block text-[13px] text-gray-900">
            {cycle.biomassGainKg != null ? `${cycle.biomassGainKg} kg` : "—"}
          </b>
          gain
        </span>
      </div>
    </button>
  );
}
