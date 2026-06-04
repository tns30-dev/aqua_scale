import { clsx } from 'clsx';
import type { PondOperationalStatus } from '../../types';

interface OperationalStatusBadgeProps {
  status?: PondOperationalStatus;
  className?: string;
}

// Visual palette kept clear of the sensor-health badge (red/yellow/green) so
// the two signals don't collide on the same card.
const STYLE: Record<Exclude<PondOperationalStatus, 'active'>, string> = {
  draining: 'bg-blue-500 text-white',
  cleaning: 'bg-cyan-500 text-white',
  maintenance: 'bg-amber-500 text-white',
  decommissioned: 'bg-gray-600 text-white',
};

const LABEL: Record<Exclude<PondOperationalStatus, 'active'>, string> = {
  draining: 'Draining',
  cleaning: 'Cleaning',
  maintenance: 'Maintenance',
  decommissioned: 'Decommissioned',
};

export function OperationalStatusBadge({ status, className }: OperationalStatusBadgeProps) {
  if (!status || status === 'active') return null;
  return (
    <span
      className={clsx(
        'inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap',
        STYLE[status],
        className,
      )}
    >
      {LABEL[status]}
    </span>
  );
}
