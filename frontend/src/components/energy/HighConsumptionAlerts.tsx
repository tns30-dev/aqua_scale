import { AlertTriangle, CheckCircle, X } from "lucide-react";
import { clsx } from "clsx";
import { EnergyCard } from "./EnergyCard";
import type { Alert } from "../../types";

function titleFor(alert: Alert): string {
  return alert.parameter === "electricity_daily"
    ? "High daily consumption"
    : "High hourly consumption";
}

function when(alert: Alert): string {
  const ts = alert.readingTimestamp ?? alert.timestamp;
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ alert }: { alert: Alert }) {
  if (!alert.acknowledged) {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
        Open
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
      Resolved
    </span>
  );
}

export function HighConsumptionAlerts({
  open,
  history,
  onResolve,
  resolvingId,
}: {
  open: Alert[];
  history: Alert[];
  onResolve: (alertId: string) => void;
  resolvingId: string | null;
}) {
  const openIds = new Set(open.map((a) => a.alertId));
  const closedHistory = history.filter((a) => !openIds.has(a.alertId));

  return (
    <EnergyCard
      title={`High Consumption Alerts (${open.length} open)`}
      info="Open alerts are pinned on top regardless of the date range. Below: alert history for the selected range."
    >
      <div className="max-h-[330px] space-y-4 overflow-y-auto pr-1">
        {open.length === 0 && closedHistory.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">
            No high consumption alerts.
          </p>
        )}

        {open.map((a) => (
          <div key={a.alertId} className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div className="min-w-0 flex-1" title={a.message}>
              <p className="text-sm font-medium text-gray-900">{titleFor(a)}</p>
              <p className="text-xs text-gray-500">{when(a)}</p>
              <p className="truncate text-xs font-semibold text-gray-700">{a.message}</p>
            </div>
            <button
              onClick={() => onResolve(a.alertId)}
              disabled={resolvingId === a.alertId}
              className={clsx(
                "flex h-7 shrink-0 items-center gap-1 self-center rounded px-2.5 text-xs font-medium transition-colors",
                resolvingId === a.alertId
                  ? "cursor-default bg-green-100 text-green-700"
                  : "text-red-700 hover:bg-red-50",
              )}
            >
              {resolvingId === a.alertId ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
              {resolvingId === a.alertId ? "Resolved" : "Resolve"}
            </button>
          </div>
        ))}

        {closedHistory.length > 0 && (
          <>
            {open.length > 0 && <div className="border-t border-gray-100" />}
            {closedHistory.map((a) => (
              <div key={a.alertId} className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1" title={a.message}>
                  <p className="text-sm font-medium text-gray-900">{titleFor(a)}</p>
                  <p className="text-xs text-gray-500">{when(a)}</p>
                </div>
                <span className="self-center">
                  <StatusBadge alert={a} />
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </EnergyCard>
  );
}
