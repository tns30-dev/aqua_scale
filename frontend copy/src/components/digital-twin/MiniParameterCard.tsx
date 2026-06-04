import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MiniParameterCardProps {
  label: string;
  value: number | null;
  previousValue?: number | null;
  unit?: string;
  status?: 'normal' | 'critical';
  variant?: 'default' | 'key';
  className?: string;
}

export function MiniParameterCard({ 
  label, 
  value, 
  previousValue,
  unit, 
  status = 'normal',
  variant = 'default',
  className
}: MiniParameterCardProps) {
  // Calculate change
  const hasChange = value !== null && previousValue !== null && previousValue !== undefined && value !== previousValue;
  const changeAmount = hasChange && previousValue !== null && previousValue !== undefined ? value - previousValue : 0;
  const changePercent = hasChange && previousValue !== null && previousValue !== undefined && previousValue !== 0 
    ? ((changeAmount / Math.abs(previousValue)) * 100) 
    : 0;
  
  const isIncrease = changeAmount > 0;
  const isDecrease = changeAmount < 0;
  const noChange = changeAmount === 0;

  const isKey = variant === 'key';

  return (
    <div
      className={clsx(
        'border-2 transition-all duration-200 h-full w-full flex flex-col', 'rounded-lg p-2 shadow-sm', 'items-center justify-center text-center',
        // colors by status
        {
          'bg-white/85 border-gray-200': status === 'normal',
          'bg-red-50 border-red-400': status === 'critical',
        },
        className
      )}
    >
    
      {/* Parameter Name */}
      <div
        className={clsx(
          'text-gray-700 mb-1',
          isKey ? 'text-xl sm:text-xl font-bold' : 'text-sm font-semibold'
        )}
      >
        {label}
      </div>
      
      {/* Main Value */}
      <div className="flex items-baseline justify-center gap-1">
        <span
          className={clsx(
            // size
            isKey ? 'text-3xl sm:text-3xl font-extrabold' : 'text-base font-bold',
            // color
            {
              'text-gray-900': status === 'normal',
              'text-red-700': status === 'critical',
            }
          )}
        >
          {value !== null ? value.toFixed(1) : '--'}
        </span>

        {unit && (
          <span className={clsx(isKey ? 'text-base sm:text-base text-gray-600' : 'text-xs text-gray-500')}>
            {unit}
          </span>
        )}
      </div>

      {/* Change Indicator - Always reserve space */}
      <div className={clsx('flex items-center justify-center gap-1 mt-1', isKey ? 'min-h-[22px]' : 'min-h-[16px]')}>

        {hasChange && (
          <>
            {isIncrease && (
              <TrendingUp
                className={clsx(isKey ? 'w-5 h-5' : 'w-3 h-3', 'text-green-600 flex-shrink-0')}
              />
            )}
            {isDecrease && (
              <TrendingDown
                className={clsx(isKey ? 'w-5 h-5' : 'w-3 h-3', 'text-red-600 flex-shrink-0')}
              />
            )}
            {noChange && (
              <Minus
                className={clsx(isKey ? 'w-5 h-5' : 'w-3 h-3', 'text-gray-400 flex-shrink-0')}
              />
            )}

            <span
              className={clsx(
                isKey ? 'text-base font-semibold' : 'text-xs font-medium',
                {
                  'text-green-600': isIncrease,
                  'text-red-600': isDecrease,
                  'text-gray-400': noChange,
                }
              )}
            >
              {isIncrease && '+'}
              {changeAmount.toFixed(1)}
              <span className={clsx(isKey ? 'text-gray-600 ml-1' : 'text-gray-500 ml-0.5')}>
                ({isIncrease && '+'}
                {changePercent.toFixed(0)}%)
              </span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}
