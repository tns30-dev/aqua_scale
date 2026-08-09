import { AlertCircle, AlertTriangle, CheckCircle, X } from "lucide-react";
import { clsx } from "clsx";
import type { Alert } from "../../types";
import { usePondStore } from "../../stores/pondStore";
import { pondLabel } from "../../utils/pondLabel";

interface AlertBannerProps {
  alert: Alert;
  onResolve: (alertId: string) => void;
  resolving?: boolean;
}

export function AlertBanner({ alert, onResolve, resolving = false }: AlertBannerProps) {
  const isCritical = alert.severity === "critical";
  const eventTime = alert.readingTimestamp ?? alert.timestamp;
  const ponds = usePondStore((s) => s.ponds);
  const pondLabelText = pondLabel(alert.pondName, alert.pondId, ponds);

  return (
    <div
      className={clsx(
        "flex items-start gap-3 rounded-lg border p-4 transition-colors duration-300",
        {
          "border-green-200 bg-green-50": resolving,
          "border-red-200 bg-red-50": !resolving && isCritical,
          "border-yellow-200 bg-yellow-50": !resolving && !isCritical,
        },
      )}
    >
      {resolving ? (
        <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
      ) : isCritical ? (
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
      ) : (
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={clsx("text-sm font-semibold", {
                "text-green-800": resolving,
                "text-red-800": !resolving && isCritical,
                "text-yellow-800": !resolving && !isCritical,
              })}
            >
              {resolving ? "Resolved: " : isCritical ? "Action Required: " : "Monitor Condition: "}
              {resolving && alert.pondId ? `${pondLabelText} - ${alert.message}` : alert.message}
            </p>
            <p
              className={clsx("mt-1 text-xs", {
                "text-green-700": resolving,
                "text-red-600": !resolving && isCritical,
                "text-yellow-600": !resolving && !isCritical,
              })}
            >
              {alert.pondId ? `${pondLabelText} - ` : ""}
              {new Date(eventTime).toLocaleString()}
            </p>
          </div>

          <button
            onClick={() => onResolve(alert.alertId)}
            className={clsx(
              "flex flex-shrink-0 items-center gap-1 rounded px-3 py-1 text-xs font-medium transition-colors",
              {
                "cursor-default bg-green-100 text-green-700": resolving,
                "text-red-700 hover:bg-red-100": !resolving && isCritical,
                "text-yellow-700 hover:bg-yellow-100": !resolving && !isCritical,
              },
            )}
            disabled={resolving}
          >
            <X className="h-3 w-3" />
            {resolving ? "Resolved" : "Resolve"}
          </button>
        </div>
      </div>
    </div>
  );
}
