import { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { useLocation } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { PondVisualization } from '../components/digital-twin/PondVisualization';
import { PondDetailsPanel } from '../components/digital-twin/PondDetailsPanel';
import { OperationalStatusBadge } from '../components/overview/OperationalStatusBadge';
// import { ParameterCard } from '../components/digital-twin/ParameterCard'; // Commented out - Section 3 removed
import { GlobalAlertToasts } from '../components/common/GlobalAlertToasts';
import type { Pond, SensorReading, SensorParameters } from '../types';
import { checkParameterStatus, getParameterLabel, getParameterUnit } from '../utils/thresholdChecker';
import { usePondStore } from '../stores/pondStore';
import { useProfile } from '../context/ProfileContext';
import { getProfileColors } from '../utils/profileColors';
import { apiService } from '../services/api.service';
import { getCurrentProjectId } from '../utils/auth';

export function DigitalTwinPage() {
  const location = useLocation();
  const initialPondId = location.state?.pondId;

  // Get current profile and filter ponds by profile
  const { currentProfile } = useProfile();
  const { ponds: storePonds, liveReadings, lastUpdated, setPonds: setStorePonds, getProfilePonds } = usePondStore();
  const [isLoadingPonds, setIsLoadingPonds] = useState(storePonds.length === 0);
  
  // Filter ponds by current profile
  const profilePonds = getProfilePonds(currentProfile);

  // Get profile colors for theming
  const colors = getProfileColors(currentProfile);

  const [selectedPond, setSelectedPond] = useState<Pond | null>(null);
  const [currentReading, setCurrentReading] = useState<SensorReading | null>(null);
  const [previousReading, setPreviousReading] = useState<SensorReading | null>(null);

  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);

  // Fetch ponds on mount if the store is empty (e.g., user landed here
  // directly via URL refresh without going through Overview first). Tracks a
  // local `isLoadingPonds` flag so we can distinguish "still fetching" from
  // "fetched but empty" — the latter must render an explicit empty state,
  // not a perpetual spinner.
  useEffect(() => {
    let cancelled = false;
    const ensureLoaded = async () => {
      if (storePonds.length > 0) {
        setIsLoadingPonds(false);
        return;
      }
      try {
        const projectId = getCurrentProjectId();
        if (projectId) {
          const response = await apiService.getPonds(projectId);
          if (!cancelled) setStorePonds(response.ponds);
        }
      } catch (err) {
        console.error('Failed to fetch ponds:', err);
      } finally {
        if (!cancelled) setIsLoadingPonds(false);
      }
    };
    ensureLoaded();
    return () => { cancelled = true; };
  }, []);

  // Set initial pond
  useEffect(() => {
    if (profilePonds.length > 0 && !selectedPond) {
      const initial = initialPondId 
        ? profilePonds.find(p => p.pond_id === initialPondId)
        : profilePonds[0];
      setSelectedPond(initial || profilePonds[0]);
    }
  }, [profilePonds, initialPondId, selectedPond]);

  // Handle profile changes - reset selected pond if not in current profile
  useEffect(() => {
    if (profilePonds.length > 0 && selectedPond) {
      // Check if current selected pond is in the filtered list
      const isPondInProfile = profilePonds.some(p => p.pond_id === selectedPond.pond_id);
      
      if (!isPondInProfile) {
        // Current pond not in profile, select first pond
        const firstPond = profilePonds[0];
        setSelectedPond(firstPond);
        
        // Update reading for new pond
        const reading = liveReadings.get(firstPond.pond_id);
        if (reading) {
          setCurrentReading(reading);
          setPreviousReading(null);
        } else {
          setCurrentReading(null);
          setPreviousReading(null);
        }
      }
    }
  }, [currentProfile, profilePonds, selectedPond, liveReadings]);

  // Update current reading when selected pond changes or live readings update
  useEffect(() => {
    if (!selectedPond) return;

    const reading = liveReadings.get(selectedPond.pond_id);
    if (reading) {
      // Store previous reading before updating
      setCurrentReading(prev => {
        if (prev && prev.timestamp !== reading.timestamp) {
          setPreviousReading(prev);
        }
        return reading;
      });

    }
  }, [selectedPond?.pond_id, liveReadings]);

  const handlePondChange = (pondId: string) => {
    const pond = profilePonds.find(p => p.pond_id === pondId);
    if (pond) {
      setSelectedPond(pond);
      
      // Immediately load existing reading for new pond
      const reading = liveReadings.get(pondId);
      if (reading) {
        setCurrentReading(reading);
        setPreviousReading(null);
      } else {
        setCurrentReading(null);
        setPreviousReading(null);
      }
    }
  };

  // Key parameters shown in Pond Details panel
  const keyParameterKeys = ['temperature', 'ph', 'dissolved_oxygen', 'turbidity'];

  // Parameter category mapping
  const parameterCategories: Record<string, 'physical' | 'chemical' | 'biological'> = {
    // Physical (7)
    temperature: 'physical',
    dissolved_oxygen: 'physical',
    turbidity: 'physical',
    salinity: 'physical',
    total_hardness: 'physical',
    alkalinity: 'physical',
    water_level: 'physical',
    
    // Chemical (12)
    ph: 'chemical',
    ph_lab: 'chemical',
    ammonia: 'chemical',
    nitrate: 'chemical',
    nitrite: 'chemical',
    ammonium: 'chemical',
    phosphate: 'chemical',
    calcium: 'chemical',
    magnesium: 'chemical',
    carbonate: 'chemical',
    bicarbonate: 'chemical',
    hydrogen_sulfide: 'chemical',
    
    // Biological (3)
    total_vibrio_count: 'biological',
    total_bacteria_count: 'biological',
    tan: 'biological',
  };

  // Generate all parameters with categories for visualization
  const allParameters = useMemo(() => {
    if (!currentReading?.parameters) return [];

    const params = currentReading.parameters;
    const prevParams = previousReading?.parameters;

    return Object.entries(params)
      .filter(([_, value]) => value !== null && value !== undefined)
      .map(([key, value]) => ({
        key,
        label: getParameterLabel(key),
        value: value as number,
        previousValue: prevParams?.[key as keyof SensorParameters] as number | undefined,
        unit: getParameterUnit(key),
        status: checkParameterStatus(key, value as number),
        category: parameterCategories[key] || 'physical',
        isKey: keyParameterKeys.includes(key),
      }));
  }, [currentReading, previousReading]);

  // Remaining 16 parameters for bottom grid (COMMENTED OUT - Section 3 removed)
  /*
  const remainingParameters = useMemo(() => {
    if (!currentReading?.parameters) return [];

    const params = currentReading.parameters;
    const prevParams = previousReading?.parameters;

    // All parameters except the 4 key ones
    return Object.entries(params)
      .filter(([key]) => !keyParameterKeys.includes(key))
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => ({
        key,
        label: getParameterLabel(key),
        value: value as number,
        previousValue: prevParams?.[key as keyof SensorParameters] as number | undefined,
        unit: getParameterUnit(key),
        status: checkParameterStatus(key, value as number),
      }));
  }, [currentReading, previousReading]);
  */

  if (isLoadingPonds) {
    return (
      <AppShell>
        <PageContainer>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading Digital Twin...</p>
            </div>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  if (profilePonds.length === 0) {
    return (
      <AppShell>
        <PageContainer>
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-900 font-medium">No Ponds Available for this project.</p>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Digital Twin - 3D Pond Simulation</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Immersive real-time visualization of pond environment and water quality
          </p>
        </div>

        {/* Pond Selector + Live Info */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedPond?.pond_id || ''}
              onChange={(e) => handlePondChange(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent bg-white transition-all"
              style={{ borderColor: colors.primary }}
            >
              {profilePonds.map((pond) => (
                <option key={pond.pond_id} value={pond.pond_id}>
                  {pond.name}
                </option>
              ))}
            </select>
            <OperationalStatusBadge status={selectedPond?.status} />
          </div>

          {/* Live + Timestamp */}
          <div className="flex items-center gap-2 text-xs sm:text-sm flex-wrap">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
            <span className="text-green-600 font-medium">Live</span>
            <span className="text-gray-400">|</span>
            {lastUpdated && (
              <span className="text-gray-500 break-words">
                Last Updated: {lastUpdated.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Main Layout: Visualization + Details */}
        <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 items-stretch">
          {/* Left: Visualization */}
          <div className="flex-1 min-w-0">
            <PondVisualization
              pondName={selectedPond?.name || ''}
              parameters={allParameters}
            />
          </div>

          {/* Right: Details Panel */}
          <div
            className={clsx(
              'relative transition-all duration-300 ease-in-out flex-shrink-0',
              // Mobile + Tablet (including iPad portrait): full width, no collapse
              'w-full',
              // Desktop only (xl+): collapsible widths
              isDetailsCollapsed ? 'xl:w-14' : 'xl:w-[360px]'
            )}
          >
            {/* Toggle button: desktop only (xl+) */}
            <button
              type="button"
              onClick={() => setIsDetailsCollapsed((v) => !v)}
              className="hidden xl:flex absolute -left-3 top-6 z-20 h-8 w-8 rounded-full bg-white border border-gray-200 shadow items-center justify-center hover:bg-gray-50"
              aria-label={isDetailsCollapsed ? 'Expand details panel' : 'Collapse details panel'}
              title={isDetailsCollapsed ? 'Expand' : 'Collapse'}
            >
              <span className="text-gray-600 text-lg leading-none">
                {isDetailsCollapsed ? '‹' : '›'}
              </span>
            </button>

            <div className="h-full">
              {/* Mobile/Tablet: always expanded */}
              <div className="xl:hidden">
                <PondDetailsPanel
                  pondName={selectedPond?.name || ''}
                  pondId={selectedPond?.pond_id}
                  photoUrl={selectedPond?.photo_url}
                  metadata={selectedPond?.metadata}
                  currentParameters={currentReading?.parameters}
                  previousParameters={previousReading?.parameters}
                />
              </div>

              {/* Desktop: collapsible */}
              <div className="hidden xl:block h-full">
                {isDetailsCollapsed ? (
                  <div className="h-full rounded-lg border border-gray-200 bg-white flex flex-col items-center justify-start pt-16 gap-4">
                    <div className="rotate-90 text-sm font-semibold text-gray-700 whitespace-nowrap">
                      Pond Details
                    </div>
                  </div>
                ) : (
                  <PondDetailsPanel
                    pondName={selectedPond?.name || ''}
                    pondId={selectedPond?.pond_id}
                    photoUrl={selectedPond?.photo_url}
                    metadata={selectedPond?.metadata}
                    currentParameters={currentReading?.parameters}
                    previousParameters={previousReading?.parameters}
                  />
                )}
              </div>
            </div>
          </div>
        </div>


      </PageContainer>

      <GlobalAlertToasts />
    </AppShell>
  );
}


