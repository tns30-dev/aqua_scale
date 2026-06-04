import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../design-system';
import { MapPin, Building2, TrendingUp, Calendar } from 'lucide-react';
import type { PondMetadata, PondTreatment, SensorParameters } from '../../types';
import { clsx } from 'clsx';
import { useProfile } from '../../context/ProfileContext';
import { apiService } from '../../services/api.service';

interface PondDetailsPanelProps {
  pondName: string;
  pondId?: string;
  photoUrl?: string;
  metadata?: PondMetadata;
  currentParameters?: SensorParameters;
  previousParameters?: SensorParameters;
}

type DiseaseRisk = 'low' | 'medium' | 'high';

const riskColors: Record<DiseaseRisk, string> = {
  low: 'text-green-600 bg-green-50',
  medium: 'text-yellow-600 bg-yellow-50',
  high: 'text-red-600 bg-red-50',
};

// Profile-specific image configuration
const profileImageConfig: Record<string, { emoji: string; label: string }> = {
  fish: {
    emoji: '🐟',
    label: 'Fish Tank'
  },
  crab_hatchery: {
    emoji: '🦀',
    label: 'Crab Tank'
  },
  shrimp: {
    emoji: '🦐',
    label: 'Shrimp Pond'
  },
  treatment: {
    emoji: '💧',
    label: 'Treatment System'
  }
};

export function PondDetailsPanel({
  pondName,
  pondId,
  photoUrl,
  metadata,
}: PondDetailsPanelProps) {
  const [imageFailed, setImageFailed] = useState(false);

  // Get current profile for conditional rendering
  const { currentProfile, profileConfig } = useProfile();

  // Get profile-specific config
  const profileConfig_image = profileImageConfig[currentProfile] || profileImageConfig.shrimp;

  // ── Treatments ──────────────────────────────────────────────────────────
  // Fetch per-pond treatments when the selected pond changes. The cancelled
  // flag protects against rapid pond-switching landing stale rows.
  const [treatments, setTreatments] = useState<PondTreatment[]>([]);
  const [treatmentsState, setTreatmentsState] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    if (!pondId) {
      setTreatments([]);
      setTreatmentsState('idle');
      return;
    }
    let cancelled = false;
    setTreatmentsState('loading');
    apiService.getPondTreatments(pondId)
      .then((rows) => {
        if (cancelled) return;
        setTreatments(rows);
        setTreatmentsState('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setTreatmentsState('error');
      });
    return () => { cancelled = true; };
  }, [pondId]);

  const sortedTreatments = useMemo(() => {
    const active = treatments
      .filter((t) => t.is_active)
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
    const past = treatments
      .filter((t) => !t.is_active)
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
    return [...active, ...past];
  }, [treatments]);

  return (
    <Card className="p-6 space-y-6">
      <h3 className="text-xl font-semibold text-gray-900">Pond Details</h3>

      {/* Company Info + Photo Side by Side */}
      <div className="flex gap-4">
        {/* Left: Company and GPS */}
        <div className="flex-1 space-y-3">
          {metadata ? (
            <>
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Company</p>
                  <p className="text-base font-medium text-gray-900">{metadata.company_name}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">GPS Location</p>
                  <p className="text-base font-medium text-gray-900">{metadata.gps_location}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500">
              <p className="font-medium text-gray-900 mb-2">{pondName}</p>
              <p className="text-sm">Metadata not configured for this pond</p>
            </div>
          )}
        </div>

        {/* Right: Pond Photo */}
        <div className="w-32 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
          {photoUrl && !photoUrl.includes('placeholder') && !imageFailed ? (
            // Try to load actual photo URL
            <img 
              src={photoUrl}
              alt={pondName}
              className="w-full h-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            // Fallback to colored background with emoji (all profiles)
            <div 
              className="w-full h-full flex flex-col items-center justify-center"
              style={{ backgroundColor: profileConfig.theme.primary }}
            >
              <span className="text-white text-2xl mb-1">{profileConfig_image.emoji}</span>
              <span className="text-white text-xs font-medium">{profileConfig_image.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Farm/Hatchery Metrics - Conditional by Profile */}
      {metadata && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-base font-semibold text-gray-900 mb-3">
            {currentProfile === 'crab_hatchery' ? 'Hatchery Metrics' : 'Farm Metrics'}
          </h4>
          
          {currentProfile === 'crab_hatchery' ? (
            // Crab Hatchery specific metrics
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-base text-gray-600">Larvae Count</span>
                <span className="text-base font-bold text-gray-900">
                  {(metadata as any).larvae_count?.toLocaleString() || 'N/A'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-base text-gray-600">Survival Rate</span>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-base font-bold text-gray-900">
                    {(metadata as any).survival_rate_percent || 'N/A'}%
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-base text-gray-600">Disease Risk</span>
                <span className={clsx(
                  'text-sm font-semibold px-2 py-1 rounded-full',
                  riskColors[(metadata.disease_risk ?? 'low') as DiseaseRisk]
                )}>
                  {((metadata.disease_risk ?? 'low').charAt(0).toUpperCase() + (metadata.disease_risk ?? 'low').slice(1))}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-base text-gray-600 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Est. Harvest
                </span>
                <span className="text-base font-bold text-gray-900">
                  {metadata.estimated_harvest_date ? new Date(metadata.estimated_harvest_date).toLocaleDateString() : 'N/A'}
                </span>
              </div>

              <div className="text-sm text-gray-500 pt-2 border-t border-gray-200">
                <span className="font-medium">Species:</span> {(metadata as any).target_species || 'N/A'}
              </div>
            </div>
          ) : (
            // Shrimp/Fish farm metrics (same structure)
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-base text-gray-600">Biomass</span>
                <span className="text-base font-bold text-gray-900">{metadata.biomass_kg} kg</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-base text-gray-600">Growth Rate</span>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-base font-bold text-gray-900">
                    {metadata.growth_rate_percent_per_day}%/day
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-base text-gray-600">Disease Risk</span>
                <span className={clsx(
                  'text-sm font-semibold px-2 py-1 rounded-full',
                  riskColors[(metadata.disease_risk ?? 'low') as DiseaseRisk]
                )}>
                  {((metadata.disease_risk ?? 'low').charAt(0).toUpperCase() + (metadata.disease_risk ?? 'low').slice(1))}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-base text-gray-600 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Est. Harvest
                </span>
                <span className="text-base font-bold text-gray-900">
                  {metadata.estimated_harvest_date ? new Date(metadata.estimated_harvest_date).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Treatments */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-base font-semibold text-gray-900 mb-3">Treatments</h4>

        {treatmentsState === 'loading' && (
          <p className="text-sm text-gray-500 italic">Loading treatments...</p>
        )}
        {treatmentsState === 'error' && (
          <p className="text-sm text-red-600">Couldn't load treatments</p>
        )}
        {treatmentsState === 'idle' && sortedTreatments.length === 0 && (
          <p className="text-sm text-gray-500 italic">No treatments recorded for this pond</p>
        )}
        {treatmentsState === 'idle' && sortedTreatments.length > 0 && (
          <ul className="space-y-2">
            {sortedTreatments.map((t) => (
              <li
                key={t.pond_treatment_id}
                className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={clsx(
                      'text-base text-gray-900 truncate',
                      t.is_active && 'font-semibold',
                    )}
                  >
                    {t.treatment_name}
                  </span>
                  {t.is_active && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      Active
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {t.is_active
                    ? `Since ${new Date(t.started_at).toLocaleDateString()}`
                    : `${new Date(t.started_at).toLocaleDateString()} → ${
                        t.ended_at ? new Date(t.ended_at).toLocaleDateString() : '—'
                      }`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}


