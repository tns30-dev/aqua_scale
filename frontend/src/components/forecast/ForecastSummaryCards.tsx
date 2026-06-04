import { Calendar, AlertTriangle, Activity, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '../../design-system';
import type { PondMetadata } from '../../types';

interface ForecastSummaryCardsProps {
  metadata?: PondMetadata;
}

export function ForecastSummaryCards({ metadata }: ForecastSummaryCardsProps) {
  const estimatedHarvest = metadata?.estimated_harvest_date
    ? new Date(metadata.estimated_harvest_date)
    : null;

  const daysUntilHarvest =
    estimatedHarvest !== null
      ? Math.max(0, Math.ceil((estimatedHarvest.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 42;

  const cards = [
    {
      label: 'Predicted Harvest',
      value:
        estimatedHarvest !== null
          ? estimatedHarvest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Dec 15, 2025',
      subtitle:
        estimatedHarvest !== null
          ? `${daysUntilHarvest} day${daysUntilHarvest === 1 ? '' : 's'} remaining`
          : '42 days remaining',
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Disease Risk Index',
      value: (metadata?.disease_risk ?? 'low').toUpperCase(),
      subtitle: metadata?.disease_risk ? `${metadata.disease_risk} risk` : '0.12 risk score',
      icon: AlertTriangle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      label: 'Pond Health',
      value: metadata ? 'Stable' : 'Excellent',
      subtitle: metadata ? 'Based on recent sensor trends' : '92% score',
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'AI Forecast Status',
      value: 'Stable',
      subtitle: 'Next 48h outlook',
      icon: TrendingUp,
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
    },
  ];

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="flex items-center gap-3 sm:gap-4 min-w-0" padding="md">
            <div className={clsx('p-2.5 sm:p-3 rounded-lg shrink-0', card.bgColor)}>
              <Icon className={clsx('w-5 h-5 sm:w-6 sm:h-6', card.color)}/>
            </div>

            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600 truncate">{card.label}</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{card.value}</p>
              <p className="text-xs text-gray-500 truncate">{card.subtitle}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
