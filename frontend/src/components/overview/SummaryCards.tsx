import { Droplets, AlertTriangle, Activity, TrendingUp } from 'lucide-react';
import { Card } from '../../design-system';
import type { ProjectSummary } from '../../types';
import { clsx } from 'clsx';

interface SummaryCardsProps {
  summary: ProjectSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const cards = [
    {
      label: 'Total Ponds',
      value: summary.totalPonds,
      icon: Droplets,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Active Alerts',
      value: summary.activeAlerts,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      label: 'Avg Quality',
      value: `${summary.averageQuality}%`,
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Forecast',
      value: summary.forecast.charAt(0).toUpperCase() + summary.forecast.slice(1),
      icon: TrendingUp,
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card key={card.label} className="flex items-center gap-3 sm:gap-4 min-w-0" padding="md">
            <div className={clsx('p-2.5 sm:p-3 rounded-lg shrink-0', card.bgColor)}>
              <Icon className={clsx('w-5 h-5 sm:w-6 sm:h-6', card.color)} />
            </div>

            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-600">{card.label}</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
