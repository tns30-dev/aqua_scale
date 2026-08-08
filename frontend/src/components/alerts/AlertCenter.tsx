import { AlertBanner } from "./AlertBanner";
import { useAlerts } from "../../context/AlertsContext";

export function AlertCenter() {
  const { alerts, resolvingIds, resolve } = useAlerts();

  if (alerts.length === 0) return null;

  const ordered = [
    ...alerts.filter((alert) => alert.severity === "critical"),
    ...alerts.filter((alert) => alert.severity !== "critical"),
  ];

  return (
    <div className="space-y-3 px-6 pt-6">
      {ordered.map((alert) => (
        <AlertBanner
          key={alert.alertId}
          alert={alert}
          onResolve={resolve}
          resolving={resolvingIds.has(alert.alertId)}
        />
      ))}
    </div>
  );
}
