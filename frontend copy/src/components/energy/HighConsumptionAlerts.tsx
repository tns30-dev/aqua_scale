import { AlertTriangle } from "lucide-react";
import { EnergyCard } from "./EnergyCard";
import type { EnergyAlert } from "./types";

export function HighConsumptionAlerts({ alerts }: { alerts: EnergyAlert[] }) {
  return (
    <EnergyCard
      title="High Consumption Alerts"
      action={
        <button className="text-xs font-medium text-emerald-600 hover:text-emerald-700">View All</button>
      }
    >
      <div className="space-y-4">
        {alerts.map((a, i) => (
          <div key={i} className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{a.title}</p>
              <p className="text-xs text-gray-500">{a.when}</p>
              <p className="text-xs font-semibold text-gray-700">{a.value}</p>
            </div>
          </div>
        ))}
      </div>
    </EnergyCard>
  );
}
