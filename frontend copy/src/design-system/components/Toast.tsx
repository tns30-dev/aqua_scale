import { useEffect } from 'react';
import { clsx } from 'clsx';
import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

interface ToastProps {
  message: string;
  open: boolean;
  onClose: () => void;
  severity?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

export function Toast({ message, open, onClose, severity = 'info', duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (open && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [open, duration, onClose]);

  if (!open) return null;

  const icons = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: AlertTriangle,
  };

  const Icon = icons[severity];

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div
        className={clsx(
          'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg',
          'min-w-[300px] max-w-md',
          {
            'bg-green-50 border border-green-200': severity === 'success',
            'bg-red-50 border border-red-200': severity === 'error',
            'bg-blue-50 border border-blue-200': severity === 'info',
            'bg-yellow-50 border border-yellow-200': severity === 'warning',
          }
        )}
      >
        <Icon
          className={clsx('w-5 h-5', {
            'text-green-600': severity === 'success',
            'text-red-600': severity === 'error',
            'text-blue-600': severity === 'info',
            'text-yellow-600': severity === 'warning',
          })}
        />
        <span
          className={clsx('flex-1 text-sm font-medium', {
            'text-green-800': severity === 'success',
            'text-red-800': severity === 'error',
            'text-blue-800': severity === 'info',
            'text-yellow-800': severity === 'warning',
          })}
        >
          {message}
        </span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

