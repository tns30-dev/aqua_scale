import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ParameterCardProps {
  label: string;
  value: number | null;
  previousValue?: number | null;
  unit?: string;
  icon?: LucideIcon;
  status?: 'normal' | 'critical';
}

export function ParameterCard({ 
  label, 
  value, 
  previousValue,
  unit, 
  icon: Icon,
  status = 'normal',
}: ParameterCardProps) {
  // Calculate change
  const hasChange = value !== null && previousValue !== null && previousValue !== undefined && value !== previousValue;
  const changeAmount = hasChange && previousValue !== null && previousValue !== undefined ? value - previousValue : 0;
  const changePercent = hasChange && previousValue !== null && previousValue !== undefined && previousValue !== 0 
    ? ((changeAmount / Math.abs(previousValue)) * 100) 
    : 0;
  
  const isIncrease = changeAmount > 0;
  const isDecrease = changeAmount < 0;
  const noChange = changeAmount === 0;

  return (
    <div className={clsx(
      'border-2 rounded-lg p-4 transition-all duration-200',
      {
        'bg-white border-gray-200': status === 'normal',
        'bg-red-50 border-red-400': status === 'critical',
      }
    )}>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="w-4 h-4 text-gray-500" />}
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      
      {/* Main Value */}
      <div className="flex items-baseline gap-1">
        <span className={clsx('text-2xl font-bold', {
          'text-gray-900': status === 'normal',
          'text-red-700': status === 'critical',
        })}>
          {value !== null ? value.toFixed(2) : '--'}
        </span>
        {unit && (
          <span className="text-sm text-gray-500 ml-1">{unit}</span>
        )}
      </div>

      {/* Change Indicator */}
      {hasChange && (
        <div className="flex items-center gap-1 mt-2">
          {isIncrease && <TrendingUp className="w-3 h-3 text-green-600" />}
          {isDecrease && <TrendingDown className="w-3 h-3 text-red-600" />}
          {noChange && <Minus className="w-3 h-3 text-gray-400" />}
          <span className={clsx('text-xs font-medium', {
            'text-green-600': isIncrease,
            'text-red-600': isDecrease,
            'text-gray-400': noChange,
          })}>
            {isIncrease && '+'}
            {changeAmount.toFixed(2)} {unit}
            <span className="text-gray-500 ml-1">
              ({isIncrease && '+'}{changePercent.toFixed(1)}%)
            </span>
          </span>
        </div>
      )}
    </div>
  );
}


