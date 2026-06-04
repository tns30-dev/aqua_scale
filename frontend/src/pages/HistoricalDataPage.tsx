import { useEffect, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { HealthStatusOverview } from '../components/historical/HealthStatusOverview';
import { HistoricalTrendsAnalysis } from '../components/historical/HistoricalTrendsAnalysis';
import { GlobalAlertToasts } from '../components/common/GlobalAlertToasts';
import { useCycleStore } from '../stores/cycleStore';
import { usePondStore } from '../stores/pondStore';
import { useProfile } from '../context/ProfileContext';
import { apiService } from '../services/api.service';
import { getProfileColors } from '../utils/profileColors';
import type { Pond } from '../types';

export function HistoricalDataPage() {
  const { currentProfile } = useProfile();
  const { getProfilePonds } = usePondStore();
  
  // Derive ponds reactively from the store (same pattern as DigitalTwinPage/ForecastPage)
  const ponds = getProfilePonds(currentProfile);

  const [selectedPond, setSelectedPond] = useState<Pond | null>(null);

  const {
    currentCycle,
    profileTemplate,
    isLoading,
    error,
    setCycles,
    setCurrentCycle,
    setProfileTemplate,
    setLoading,
    setError
  } = useCycleStore();

  // Set initial pond when ponds become available (handles refresh case)
  useEffect(() => {
    if (ponds.length > 0 && !selectedPond) {
      setSelectedPond(ponds[0]);
    }
  }, [ponds, selectedPond]);

  // Reset selection when profile changes and current pond is no longer in the list
  useEffect(() => {
    if (ponds.length > 0 && selectedPond) {
      const isPondInProfile = ponds.some(p => p.pond_id === selectedPond.pond_id);
      if (!isPondInProfile) {
        setSelectedPond(ponds[0]);
        setCycles([]);
        setCurrentCycle(null);
        setProfileTemplate(null);
      }
    }
  }, [currentProfile, ponds, selectedPond, setCycles, setCurrentCycle, setProfileTemplate]);

  // Fetch cycles when pond changes
  useEffect(() => {
    if (!selectedPond) {
      return;
    }

    const fetchCycles = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use the project_id from the selected pond
        const projectId = selectedPond.project_id;
        const pondId = selectedPond.pond_id;

        // Fetch cycles for selected pond
        const response = await apiService.getProjectCycles(projectId, pondId);

        setCycles(response.cycles);
        setProfileTemplate(response.profileTemplate);

        // DEFAULT TO LATEST CYCLE (index 0, since sorted DESC by date)
        const defaultCycle = response.cycles[0];
        
        if (defaultCycle) {
          const cycleDetails = await apiService.getCycleDetails(defaultCycle.cycleId);
          setCurrentCycle(cycleDetails);
        } else {
          console.warn('   ⚠️ No cycles found for this pond');
        }
      } catch (err) {
        console.error('❌ Error fetching cycles:', err);
        setError('Failed to load cycle data');
      } finally {
        setLoading(false);
      }
    };

    fetchCycles();
  }, [selectedPond, setCycles, setCurrentCycle, setProfileTemplate, setLoading, setError]);

  // Get profile colors for theming
  const colors = profileTemplate 
    ? getProfileColors(profileTemplate.profileType) 
    : getProfileColors('shrimp');

  if (isLoading && !currentCycle) {
    return (
      <AppShell>
        <PageContainer>
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">Loading cycle data...</div>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <PageContainer>
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-red-600">{error}</div>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer className="space-y-4 sm:space-y-6">
        {/* Page Header */}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Historical Data Analysis
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Explore time-series trends, correlations, and seasonal patterns
          </p>
        </div>

        {/* Pond Selector & Export Button */}
        <div className="flex flex-col sm:flex-row xl:items-center xl:justify-between gap-3">
          {ponds.length > 0 ? (
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
              <select
                value={selectedPond?.pond_id || ''}
                onChange={(e) => {
                  const pond = ponds.find((p) => p.pond_id === e.target.value);
                  setSelectedPond(pond || null);
                }}
                className="w-full sm:w-auto px-4 py-2 border-2 rounded-lg focus:outline-none transition-all bg-white"
                style={{
                  borderColor: colors.primary,
                }}>
                {ponds.map((pond) => (
                  <option key={pond.pond_id} value={pond.pond_id}>
                    {pond.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              No ponds available for this profile.
            </div>
          )}

          <button
            className="w-full sm:w-auto px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: colors.primary }}
            onClick={() => {
              // TODO: Implement export functionality
            }}
          >
            Export Data
          </button>
        </div>

        {/* Section 1: Health Status Overview */}
        <div
          className="bg-white rounded-lg border-2 p-4 sm:p-5 lg:p-6 overflow-visible"
          style={{ borderColor: colors.primary + '40' }}
        >
          <HealthStatusOverview />
        </div>

        {/* Section 2: Historical Trends & Analysis */}
        <div
          className="bg-white rounded-lg border-2 p-4 sm:p-5 lg:p-6"
          style={{ borderColor: colors.primary + '40' }}
        >
          <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6" style={{ color: colors.primary }}>
            Historical Trends & Analysis
          </h2>

          {selectedPond ? (
            <HistoricalTrendsAnalysis
              selectedPondId={selectedPond.pond_id}
              projectId={selectedPond.project_id}
              profileType={profileTemplate?.profileType || 'shrimp'}
            />
          ) : (
            <div className="flex items-center justify-center h-48 sm:h-64 text-gray-500 text-sm sm:text-base text-center">
              Please select a pond to view historical data
            </div>
          )}
        </div>
      </PageContainer>

      <GlobalAlertToasts />
    </AppShell>
  );
}
