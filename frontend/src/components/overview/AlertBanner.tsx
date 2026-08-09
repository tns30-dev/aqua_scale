import { X, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import type { Alert } from '../../types';
import { usePondStore } from '../../stores/pondStore';
import { pondLabel } from '../../utils/pondLabel';

interface AlertBannerProps {
  alert: Alert;
  onResolve: (alertId: string) => void;
  resolving?: boolean;
}

export function AlertBanner({ alert, onResolve, resolving = false }: AlertBannerProps) {
  const isCritical = alert.severity === 'critical';
  const ponds = usePondStore((s) => s.ponds);
  const pondLabelText = pondLabel(alert.pondName, alert.pondId, ponds);

  return (
    <div
      className={clsx(
        'flex items-start gap-3 p-4 rounded-lg border transition-colors duration-300',
        {
          'bg-green-50 border-green-200': resolving,
          'bg-red-50 border-red-200': !resolving && isCritical,
          'bg-yellow-50 border-yellow-200': !resolving && !isCritical,
        }
      )}
    >
      {/* Icon */}
      {resolving ? (
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
      ) : isCritical ? (
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p
              className={clsx('font-semibold text-sm', {
                'text-green-800': resolving,
                'text-red-800': !resolving && isCritical,
                'text-yellow-800': !resolving && !isCritical,
              })}
            >
              {resolving ? 'Resolved: ' : isCritical ? 'Action Required: ' : 'Monitor Condition: '}
              {resolving ? `${pondLabelText} - ${alert.message}` : alert.message}
            </p>
            <p
              className={clsx('text-xs mt-1', {
                'text-green-700': resolving,
                'text-red-600': !resolving && isCritical,
                'text-yellow-600': !resolving && !isCritical,
              })}
            >
              {pondLabelText} • {new Date(alert.timestamp).toLocaleString()}
            </p>
          </div>

          {/* Resolve Button */}
          <button
            onClick={() => onResolve(alert.alertId)}
            className={clsx(
              'flex items-center gap-1 px-3 py-1 rounded text-xs font-medium',
              'transition-colors flex-shrink-0',
              {
                'text-green-700 bg-green-100 cursor-default': resolving,
                'text-red-700 hover:bg-red-100': !resolving && isCritical,
                'text-yellow-700 hover:bg-yellow-100': !resolving && !isCritical,
              }
            )}
            disabled={resolving}
          >
            <X className="w-3 h-3" />
            {resolving ? 'Resolved' : 'Resolve'}
          </button>
        </div>
      </div>
    </div>
  );
}

