import { useProfile } from '../../context/ProfileContext';
import { MiniParameterCard } from './MiniParameterCard';
import { ParameterGrid } from './ParameterGrid';

export interface ParameterData {
  key: string;
  label: string;
  value: number | null;
  previousValue?: number | null;
  unit: string;
  status: 'normal' | 'critical';
  category: 'physical' | 'chemical' | 'biological';
  isKey?: boolean;
}

interface PondVisualizationProps {
  pondName: string;
  parameters: ParameterData[];
}

export function PondVisualization({ pondName, parameters }: PondVisualizationProps) {
  const { currentProfile, profileConfig } = useProfile();

  // Group parameters by category
  const physicalParams = parameters.filter((p) => p.category === 'physical');
  const chemicalParams = parameters.filter((p) => p.category === 'chemical');
  const biologicalParams = parameters.filter((p) => p.category === 'biological');

  // Get background image path based on profile
  const getBackgroundImage = () => {
    switch (currentProfile) {
      case 'fish':
        return '/images/fish-tank-background.jpg';
      case 'crab_hatchery':
        return '/images/crab-tank-background.jpg';
      case 'shrimp':
        return '/images/aquaculture-system.jpg';
      default:
        return '/images/aquaculture-system.jpg';
    }
  };

  if (parameters.length === 0) {
    return (
      <div className="w-full h-72 sm:h-96 flex items-center justify-center bg-white border-2 border-dashed border-gray-200 rounded-lg p-4">
        <span className="text-gray-400 text-sm sm:text-base text-center">
          No parameters available for visualization.
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 lg:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4 min-w-0">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 min-w-0 break-words">
          {pondName} - Live 3D Environment
        </h3>

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <span className="text-xs sm:text-sm text-center px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium whitespace-nowrap">
            All sensors active
          </span>
        </div>
      </div>

      {/* 3D Visualization Container with Background Image */}
      <div
        className="relative w-full rounded-xl overflow-hidden p-3 sm:p-4 lg:p-5"
        style={{ background: profileConfig.theme.primary }}
      >
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{ backgroundImage: `url(${getBackgroundImage()})` }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />

        {/* Decorative overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-900/30 to-cyan-900/50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-400/10 via-transparent to-transparent" />

        {/* CONTENT (normal flow; height follows content) */}
        <div className="relative z-10 flex flex-col gap-3 sm:gap-4">
          {/* Chemical */}
          <div className="border border-white/30 rounded-xl p-3 sm:p-4 bg-black/10">
            <div className="text-sm sm:text-base font-semibold text-white/90 mb-2">
              Chemical Parameters
            </div>

            {chemicalParams.length === 0 ? (
              <div className="text-white/70 text-sm text-center italic py-2">
                No chemical parameters available for visualization.
              </div>
            ) : (
              <ParameterGrid items={chemicalParams} />
            )}
          </div>

          {/* Bottom area: stack on mobile, split on lg */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 items-start">
            {/* Physical (takes 2/3 on large screens) */}
            <div className="lg:col-span-2 border border-white/30 rounded-xl p-3 sm:p-4 bg-black/10">
              <div className="text-sm sm:text-base font-semibold text-white/90 mb-2">
                Physical Parameters
              </div>

              {physicalParams.length === 0 ? (
                <div className="text-white/70 text-sm text-center italic py-2">
                  No physical parameters available for visualization.
                </div>
              ) : (
                <ParameterGrid items={physicalParams} />
              )}
            </div>

            {/* Biological (1/3 on large screens, full width on mobile) */}
            <div className="border border-white/30 rounded-xl p-3 sm:p-4 bg-black/10">
              <div className="text-sm sm:text-base font-semibold text-white/90 mb-2">
                Biological Parameters
              </div>

              {biologicalParams.length === 0 ? (
                <div className="text-white/70 text-sm text-center italic py-2">
                  No biological parameters available for visualization.
                </div>
              ) : (
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-1">
                  {biologicalParams.map((param) => (
                    <MiniParameterCard
                      key={param.key}
                      label={param.label}
                      value={param.value}
                      previousValue={param.previousValue}
                      unit={param.unit}
                      status={param.status}
                      variant={param.isKey ? 'key' : 'default'}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
