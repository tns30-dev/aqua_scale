import { useState, useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { PondGrid } from '../components/overview/PondGrid';
import { SummaryCards } from '../components/overview/SummaryCards';
import { apiService } from '../services/api.service';
import { getCurrentProjectId } from '../utils/auth';
import type { ProjectSummary } from '../types';
import { usePondStore } from '../stores/pondStore';
import { calculatePondStatus } from '../utils/pondStatusCalculator';
import { useProfile } from '../context/ProfileContext';
import { useAlerts } from '../context/AlertsContext';

export function OverviewPage() {
  // Get current profile type for filtering — userProfiles is now derived
  // reactively from SessionContext, so no manual refresh is needed here.
  const { currentProfile } = useProfile();


  // Get ponds and readings from global store
  const { ponds: storePonds, liveReadings, lastUpdated, setPonds: setStorePonds, getProfilePonds } = usePondStore();
  const { alerts: globalAlerts } = useAlerts();

  // Filter ponds by current profile
  const profilePonds = getProfilePonds(currentProfile);
  
  const [ponds, setPonds] = useState(profilePonds);
  const [summary, setSummary] = useState<ProjectSummary>({
    totalPonds: 0,
    activeAlerts: 0,
    averageQuality: 87,
    forecast: 'good',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const readablePondCount = ponds.filter((pond) => liveReadings.has(pond.pond_id)).length;
  const healthyPondCount = ponds.filter(
    (pond) => calculatePondStatus(liveReadings.get(pond.pond_id)) === 'healthy',
  ).length;
  const displayedAverageQuality =
    ponds.length > 0 && readablePondCount > 0
      ? Math.round((healthyPondCount / ponds.length) * 100)
      : summary.averageQuality;
  const displayedForecast =
    displayedAverageQuality >= 80 ? 'good' : displayedAverageQuality >= 60 ? 'fair' : 'poor';
  const displayedSummary: ProjectSummary = {
    ...summary,
    totalPonds: ponds.length,
    activeAlerts: globalAlerts.length,
    averageQuality: displayedAverageQuality,
    forecast: displayedForecast,
  };

  // Update ponds when profile changes or store updates
  useEffect(() => {
    const filtered = getProfilePonds(currentProfile);
    setPonds(filtered);
  }, [storePonds, currentProfile, getProfilePonds]);

  // Fetch ponds if store is empty (fixes initial load issue)
  useEffect(() => {
    const fetchPondsIfNeeded = async () => {
      if (storePonds.length === 0) {
        try {
          const projectId = getCurrentProjectId();
          if (projectId) {
            const response = await apiService.getPonds(projectId);
            setStorePonds(response.ponds);
          }
        } catch (err) {
          console.error('Failed to fetch ponds:', err);
        }
      }
    };

    fetchPondsIfNeeded();
  }, [storePonds.length, setStorePonds]);

  // Update pond statuses based on live readings
  useEffect(() => {
    if (liveReadings.size === 0) return;

    setPonds(prevPonds => {
      return prevPonds.map(pond => {
        const reading = liveReadings.get(pond.pond_id);
        if (!reading)
          return {
            ...pond,
            healthStatus: 'no_reading' as const,
          };

        const newStatus = calculatePondStatus(reading);
        if (pond.healthStatus !== newStatus) {
          return {
            ...pond,
            healthStatus: newStatus,
            lastUpdated: reading.timestamp,
          };
        }

        return pond;
      });
    });
  }, [liveReadings]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Refresh summary when readings update
  useEffect(() => {
    if (liveReadings.size > 0) {
      refreshSummary();
    }
  }, [liveReadings]);

  // Update summary totalPonds when filtered ponds change
  useEffect(() => {
    setSummary(prev => ({
      ...prev,
      totalPonds: ponds.length, // Use filtered pond count for current profile
    }));
  }, [ponds.length]);

  // Also refresh alerts and summary every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshSummary();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const projectId = getCurrentProjectId();
      if (!projectId) throw new Error('No project selected');

      // Summary only; alerts are handled globally by AlertCenter.
      const summaryData = await apiService.getProjectSummary(projectId);
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to fetch overview data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSummary = async () => {
    try {
      const projectId = getCurrentProjectId();
      if (!projectId) return;

      const summaryData = await apiService.getProjectSummary(projectId);
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to refresh summary:', err);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <PageContainer>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading overview...</p>
            </div>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <PageContainer>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Error loading overview</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={fetchData}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Retry
            </button>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer>
        <div className="space-y-6">
          {/* Last Updated - use global timestamp */}
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-600 font-medium">Live</span>
            <span className="text-gray-500">|</span>
            {liveReadings.size > 0 && lastUpdated && (
              <span className="text-gray-500">
                Last Updated: {lastUpdated.toLocaleString()}
              </span>
            )}
          </div>

          <SummaryCards summary={displayedSummary} />
          <PondGrid ponds={ponds} liveReadings={liveReadings} />
        </div>
      </PageContainer>
    </AppShell>
  );
}
