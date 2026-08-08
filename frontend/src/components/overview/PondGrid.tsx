import { PondCircle } from './PondCircle';
import type { Pond, SensorReading } from '../../types';
import { Badge } from '../../design-system';
import { calculatePondStatus } from '../../utils/pondStatusCalculator';

interface PondGridProps {
  ponds: Pond[];
  liveReadings?: Map<string, SensorReading>;
}

export function PondGrid({ ponds, liveReadings }: PondGridProps) {
  // Count statuses
  const healthyCount = ponds.filter(
    (pond) => calculatePondStatus(liveReadings?.get(pond.pond_id)) === 'healthy',
  ).length;
  const allHealthy = ponds.length > 0 && healthyCount === ponds.length;

  return (
    <div className="rounded-lg border border-gray-200 bg-cover bg-center bg-no-repeat p-4 sm:p-5 lg:p-6"
      style={{
        backgroundImage: `
          linear-gradient(to bottom, rgba(100,255,255,0.5), rgba(255,255,255,0.6), rgba(255,255,255,0)), url('/images/aquaculture-pond.jpg')`,
      }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 sm:mb-5 lg:mb-6">
        <div className="min-w-0">
          <h1 className="font-bold text-gray-900 mb-1 sm:mb-2 text-lg sm:text-xl">Overview</h1>
          {ponds.length > 0 && allHealthy && (
            <div className="flex items-start sm:items-center gap-2 mt-1 flex-wrap">
              <Badge variant="success" size="sm">
                Healthy
              </Badge>
              <span className="text-sm sm:text-md text-gray-600">
                All parameters are within normal range
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Pond Grid */}
      <div className="grid place-items-center grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {ponds.map((pond) => {
          const reading = liveReadings?.get(pond.pond_id);
          const pondWithStatus = !reading
            ? { ...pond, healthStatus: 'no_reading' as const }
            : { ...pond, healthStatus: calculatePondStatus(reading) };
          return (
            <PondCircle
              key={pond.pond_id}
              pond={pondWithStatus}
              reading={reading}
            />
          );
        })}
      </div>

      {/* Empty State */}
      {ponds.length === 0 && (
        <div className="w-full mt-3 rounded-xl px-3 py-2 text-center bg-gradient-to-b from-white/50 via-white/75 to-white/85 shadow-sm border border-black/5">
          <p className="text-gray-500 text-sm sm:text-base">No ponds found for this farm</p>
        </div>
      )}
    </div>
  );
}
