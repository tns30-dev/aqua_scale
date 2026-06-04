import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import type { Pond, SensorReading } from '../../types';
import { Droplets } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getTooltipParameters } from '../../utils/pondStatusCalculator';
import { getParameterLabel, getParameterUnit, checkParameterStatus } from '../../utils/thresholdChecker';
import { OperationalStatusBadge } from './OperationalStatusBadge';

interface PondCircleProps {
  pond: Pond;
  reading?: SensorReading;
}

export function PondCircle({ pond, reading }: PondCircleProps) {
  const navigate = useNavigate();
  const [isUpdating, setIsUpdating] = useState(false);

  // `healthStatus` is the sensor-derived UI signal; falls back to 'no_reading'
  // for ponds wrapped without a current reading.
  const healthStatus = pond.healthStatus ?? 'no_reading';

  // Flash animation when status changes
  useEffect(() => {
    setIsUpdating(true);
    const timer = setTimeout(() => setIsUpdating(false), 500);
    return () => clearTimeout(timer);
  }, [healthStatus]);

  const statusColors = {
    healthy: 'border-green-500 bg-green-50',
    warning: 'border-yellow-500 bg-yellow-50',
    critical: 'border-red-500 bg-red-50',
	no_reading: 'border-gray-400 bg-gray-50',
  };

  // Get parameters for tooltip (key params + any out-of-range)
  const tooltipParams = getTooltipParameters(reading);
  const hasAlerts = reading?.alerts && reading.alerts.length > 0;

  return (
    <div className="relative group">
		{/* Pond Circle */}
		<button
			onClick={() => navigate('/digital-twin', { state: { pondId: pond.pond_id } })}
			className={clsx(
			'w-32 h-32 rounded-full border-4 flex items-center justify-center',
			'transition-all duration-200 hover:scale-105 cursor-pointer',
			'relative',
			statusColors[healthStatus],
			{
				'animate-pulse': isUpdating,
			}
			)}
		>
			<div className="flex flex-col items-center justify-center">
  				<Droplets className="w-8 h-8 text-gray-400 mb-1" />
  				<p className="text-center font-medium text-base text-gray-500">{pond.name}</p>
			</div>
		</button>

		{/* Operational Status Badge (top-left) — hidden for 'active' */}
		<div className="absolute -top-2 -left-2 z-10">
			<OperationalStatusBadge status={pond.status} />
		</div>

		{/* Status Badge */}
		{healthStatus === 'no_reading' && (
			<div className="absolute -top-2 -right-2 z-10">
				<span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-400 text-white">
					No Readings
				</span>
			</div>
		)}
		{healthStatus !== 'healthy' && healthStatus !== 'no_reading' && (
			<div className="absolute -top-2 -right-2 z-10">
			<span
				className={clsx(
				'inline-block px-2 py-0.5 rounded-full text-xs font-semibold',
				{
					'bg-red-500 text-white': healthStatus === 'critical',
					'bg-yellow-500 text-white': healthStatus === 'warning',
				}
				)}
			>
				{healthStatus === 'critical' ? 'Critical' : 'Warning'}
			</span>
			</div>
		)}

		{/* Enhanced Hover Tooltip */}
		{tooltipParams.length > 0 && (
			<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
			<div className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80">
				<p className="font-semibold text-sm text-gray-900 mb-3">
				{hasAlerts ? 'Parameter Alerts:' : 'Key Parameters:'}
				</p>
				<div className="space-y-2">
				{tooltipParams.map((param, idx) => {
					const status = checkParameterStatus(param.key, param.value);
					const label = getParameterLabel(param.key);
					const unit = getParameterUnit(param.key);
					
					return (
					<div key={idx} className="text-xs">
						<div className="flex items-center justify-between">
						<span className={clsx('font-medium', {
							'text-gray-700': status === 'normal',
							'text-red-600': status === 'critical',
						})}>
							{label}
							{!param.isKey && ' ⚠️'}
						</span>
						<span className={clsx('font-bold', {
							'text-gray-900': status === 'normal',
							'text-red-600': status === 'critical',
						})}>
							{param.value.toFixed(2)} {unit}
						</span>
						</div>
						{status === 'critical' && param.alert && (
						<p className="text-red-500 text-[10px] mt-0.5">
							Threshold: {param.alert.threshold.toFixed(2)} {unit}
						</p>
						)}
					</div>
					);
				})}
				
				{hasAlerts && reading.alerts && reading.alerts.length > tooltipParams.filter(p => !p.isKey).length && (
					<p className="text-xs text-gray-500 italic mt-2">
					+{reading.alerts.length - tooltipParams.filter(p => !p.isKey).length} more parameter(s) out of range
					</p>
				)}
				</div>
				{reading && (
				<p className="text-[11px] text-gray-500 mt-2">
					Updated: {timeAgo(reading.timestamp)}
				</p>
				)}
			</div>
			</div>
		)}
    </div>
  );
}

function timeAgo(iso: string) {
  try {
    const ts = new Date(iso).getTime();
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins === 1) return '1 minute ago';
    if (mins < 60) return `${mins} minutes ago`;
    const hours = Math.floor(mins / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  } catch {
    return '—';
  }
}
