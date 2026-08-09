import { clsx } from 'clsx';
import { AlertCircle, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { usePondStore } from '../../stores/pondStore';
import { pondLabel } from '../../utils/pondLabel';

export function GlobalAlertToasts() {
  const { activeAlerts, removeAlert, ponds } = usePondStore();

  if (activeAlerts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-6 z-50 space-y-3 pointer-events-none">
      {activeAlerts.map((alert) => {
        const isResolved = alert.status === 'resolved';
        const isCritical = alert.severity === 'critical';

        return (
          <div
            key={alert.id}
            className={clsx(
              'pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-xl border min-w-[350px] max-w-md',
              'animate-slide-in-right transition-all duration-300',
              {
                'bg-red-50 border-red-300': isCritical && !isResolved,
                'bg-yellow-50 border-yellow-300': !isCritical && !isResolved,
                'bg-green-50 border-green-300': isResolved,
              }
            )}
          >
            {isResolved ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : isCritical ? (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            )}

            <div className="flex-1 min-w-0">
              <p
                className={clsx('font-semibold text-sm', {
                  'text-red-800': isCritical && !isResolved,
                  'text-yellow-800': !isCritical && !isResolved,
                  'text-green-800': isResolved,
                })}
              >
                {isResolved ? 'Resolved' : isCritical ? 'Action Required' : 'Monitor Condition'}
              </p>

              <p
                className={clsx('text-xs mt-1', {
                  'text-red-700': isCritical && !isResolved,
                  'text-yellow-700': !isCritical && !isResolved,
                  'text-green-700': isResolved,
                })}
              >
                {isResolved
                  ? `${pondLabel(alert.pondName, alert.pondId, ponds)} - ${alert.parameter} returned to normal range`
                  : `${pondLabel(alert.pondName, alert.pondId, ponds)} - ${alert.message}`}
              </p>

              <p className="text-xs text-gray-500 mt-1">
                {alert.timestamp.toLocaleTimeString()}
              </p>
            </div>

            <button
              type="button"
              onClick={() => removeAlert(alert.id)}
              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}


