import { useEffect } from 'react';
import { clsx } from 'clsx';
import { X, AlertTriangle, AlertCircle } from 'lucide-react';
import type { AlertInfo } from '../../types';

interface ToastNotificationProps {
  alert: AlertInfo;
  onClose: () => void;
  duration?: number;
}

export function ToastNotification({ alert, onClose, duration = 5000 }: ToastNotificationProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const isCritical = alert.severity === 'critical';

  return (
    <div
      className={clsx(
        'flex items-start gap-3 p-4 rounded-lg shadow-xl border min-w-[320px] max-w-md',
        'bg-white animate-slide-in-right pointer-events-auto',
        {
          'bg-red-50 border-red-300': isCritical,
          'bg-yellow-50 border-yellow-300': !isCritical,
        }
      )}
    >
      {isCritical ? (
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
      )}

      <div className="flex-1 min-w-0">
        <p
          className={clsx('font-semibold text-sm', {
            'text-red-800': isCritical,
            'text-yellow-800': !isCritical,
          })}
        >
          {isCritical ? 'Action Required' : 'Monitor Condition'}
        </p>
        <p
          className={clsx('text-xs mt-1', {
            'text-red-700': isCritical,
            'text-yellow-700': !isCritical,
          })}
        >
          {alert.message}
        </p>
      </div>

      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        aria-label="Dismiss alert"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}


