import { useState, useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { AlertBanner } from '../components/overview/AlertBanner';
import { PondGrid } from '../components/overview/PondGrid';
import { SummaryCards } from '../components/overview/SummaryCards';
import { apiService } from '../services/api.service';
import { getCurrentProjectId } from '../utils/auth';
import type { Alert, ProjectSummary } from '../types';
import { usePondStore } from '../stores/pondStore';
import { calculatePondStatus } from '../utils/pondStatusCalculator';
import { Toast } from '../design-system';
import { useProfile } from '../context/ProfileContext';

export function OverviewPage() {
  // Get current profile type for filtering — userProfiles is now derived
  // reactively from SessionContext, so no manual refresh is needed here.
  const { currentProfile } = useProfile();


  // Get ponds and readings from global store
  const { ponds: storePonds, liveReadings, lastUpdated, setPonds: setStorePonds, getProfilePonds } = usePondStore();

  // Filter ponds by current profile
  const profilePonds = getProfilePonds(currentProfile);
  
  const [ponds, setPonds] = useState(profilePonds);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<ProjectSummary>({
    totalPonds: 0,
    activeAlerts: 0,
    averageQuality: 87,
    forecast: 'good',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ackToastOpen, setAckToastOpen] = useState(false);
  const [ackToastMsg, setAckToastMsg] = useState('Alert acknowledged');
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());

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

  // Refresh alerts and summary when readings update
  useEffect(() => {
    if (liveReadings.size > 0) {
      refreshAlertsAndSummary();
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
      refreshAlertsAndSummary();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const projectId = getCurrentProjectId();
      if (!projectId) throw new Error('No project selected');

      // Fetch alerts and summary (ponds come from global store)
      const [alertsData, summaryData] = await Promise.all([
        apiService.getAlerts(projectId),
        apiService.getProjectSummary(projectId),
      ]);

      setAlerts(alertsData.alerts);
      setSummary(summaryData);
    } catch (err: any) {
      console.error('Failed to fetch overview data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAlertsAndSummary = async () => {
    try {
      const projectId = getCurrentProjectId();
      if (!projectId) return;

      const [alertsData, summaryData] = await Promise.all([
        apiService.getAlerts(projectId),
        apiService.getProjectSummary(projectId),
      ]);

      setAlerts(alertsData.alerts);
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to refresh alerts and summary:', err);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const userId = localStorage.getItem('userId') || '';
      // Mark as resolving to show green state before removal
      setResolvingIds(prev => new Set(prev).add(alertId));
      
      await apiService.acknowledgeAlert(alertId, userId);
      setAckToastMsg('Alert acknowledged');
      setAckToastOpen(true);

      // Let the green state show briefly, then remove and refresh
      setTimeout(async () => {
        setAlerts(prev => prev.filter(a => a.alertId !== alertId));
        setResolvingIds(prev => {
          const next = new Set(prev);
          next.delete(alertId);
          return next;
        });
        await refreshAlertsAndSummary();
      }, 1000);
    } catch (err) {
      console.error('Failed to resolve alert:', err);
      setAckToastMsg('Failed to acknowledge alert');
      setAckToastOpen(true);
      // Rollback resolving state on failure
      setResolvingIds(prev => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
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

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');

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

          {/* Alert Banners */}
          {criticalAlerts.length > 0 && (
            <div className="space-y-3">
              {criticalAlerts.map(alert => (
                <div key={alert.alertId} className="animate-slide-in">
                  <AlertBanner
                    alert={alert}
                    onResolve={handleResolveAlert}
                    resolving={resolvingIds.has(alert.alertId)}
                  />
                </div>
              ))}
            </div>
          )}
          {warningAlerts.length > 0 && (
            <div className="space-y-3">
              {warningAlerts.map(alert => (
                <div key={alert.alertId} className="animate-slide-in">
                  <AlertBanner
                    alert={alert}
                    onResolve={handleResolveAlert}
                    resolving={resolvingIds.has(alert.alertId)}
                  />
                </div>
              ))}
            </div>
          )}

          <SummaryCards summary={summary} />
          <PondGrid ponds={ponds} liveReadings={liveReadings} />
        </div>
        
        {/* Toast for acknowledge feedback */}
        <Toast
          message={ackToastMsg}
          open={ackToastOpen}
          onClose={() => setAckToastOpen(false)}
          severity={ackToastMsg.startsWith('Failed') ? 'error' : 'success'}
          duration={2000}
        />
      </PageContainer>
    </AppShell>
  );
}
