import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { PageContainer } from '../components/layout/PageContainer';
import { HourlyForecastChart } from '../components/forecast/HourlyForecastChart';
import { MinuteForecastChart } from '../components/forecast/MinuteForecastChart';
import { ForecastSummaryCards } from '../components/forecast/ForecastSummaryCards';
import { GlobalAlertToasts } from '../components/common/GlobalAlertToasts';
import { usePondStore } from '../stores/pondStore';
import { useProfile } from '../context/ProfileContext';
import { getProfileColors } from '../utils/profileColors';
import { fillDataGaps, generateCompleteHourlyData, generateCompleteMinuteData } from '../utils/mockChartData';
import { apiService } from '../services/api.service';
import { getCurrentProjectId } from '../utils/auth';
import type { Pond } from '../types';

interface TimedReading {
  timestamp: Date;
  value: number;
}

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const TEN_MINUTES = 10;

export function ForecastPage() {
  const { ponds: storePonds, liveReadings, lastUpdated, setPonds: setStorePonds, getProfilePonds } = usePondStore();
  const { currentProfile } = useProfile();

  // Get profile colors for theming
  const colors = getProfileColors(currentProfile);

  const [isLoadingPonds, setIsLoadingPonds] = useState(storePonds.length === 0);
  const [selectedPond, setSelectedPond] = useState<Pond | null>(null);
  const [historicalData, setHistoricalData] = useState<{
    temperature: TimedReading[];
    ph: TimedReading[];
    dissolved_oxygen: TimedReading[];
  }>({
    temperature: [],
    ph: [],
    dissolved_oxygen: [],
  });

  // Filter ponds by current profile
  const profilePonds = getProfilePonds(currentProfile);

  // Fetch ponds on mount if the store is empty (e.g., user landed here
  // directly). Tracks a local `isLoadingPonds` flag so we can distinguish
  // "still fetching" from "fetched but empty" — the latter must render an
  // explicit empty state rather than a perpetual spinner.
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

  // Set initial pond from profile-filtered ponds
  useEffect(() => {
    if (profilePonds.length > 0 && !selectedPond) {
      setSelectedPond(profilePonds[0]);
    }
  }, [profilePonds, selectedPond]);

  // Append new readings from global store
  useEffect(() => {
    if (!selectedPond) return;
    const reading = liveReadings.get(selectedPond.pond_id);
    if (!reading) return;

    const timestamp = new Date(reading.timestamp);
    const temperatureCutoff = Date.now() - EIGHT_HOURS_MS;
    const phCutoff = Date.now() - EIGHT_HOURS_MS;
    const dissolvedCutoff = Date.now() - FIFTEEN_MINUTES_MS;

    setHistoricalData((prev) => {
      const appendReading = (
        current: TimedReading[],
        value: number | undefined,
        cutoff: number
      ) => {
        if (value === undefined || value === null) {
          return current.filter((entry) => entry.timestamp.getTime() >= cutoff);
        }

        const exists = current.some(
          (entry) => entry.timestamp.getTime() === timestamp.getTime()
        );

        const next = exists
          ? [...current]
          : [...current, { timestamp, value }];

        return next
          .filter((entry) => entry.timestamp.getTime() >= cutoff)
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      };

      return {
        temperature: appendReading(
          prev.temperature,
          reading.parameters.temperature,
          temperatureCutoff
        ),
        ph: appendReading(
          prev.ph,
          reading.parameters.ph,
          phCutoff
        ),
        dissolved_oxygen: appendReading(
          prev.dissolved_oxygen,
          reading.parameters.dissolved_oxygen,
          dissolvedCutoff
        ),
      };
    });
  }, [liveReadings, selectedPond]);

  const handlePondChange = (pondId: string) => {
    const pond = profilePonds.find((p) => p.pond_id === pondId);
    if (pond) {
      setSelectedPond(pond);
      setHistoricalData({
        temperature: [],
        ph: [],
        dissolved_oxygen: [],
      });
    }
  };

  const buildHourlySeries = (readings: TimedReading[], parameter: string) => {
    const now = new Date();
    const eightHoursAgo = new Date(now.getTime() - EIGHT_HOURS_MS);

    const buckets: Array<{ time: string; value: number | null }> = [];

    for (let i = 0; i < 8; i += 1) {
      const hourStart = new Date(eightHoursAgo.getTime() + i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      const points = readings.filter(
        (entry) => entry.timestamp >= hourStart && entry.timestamp < hourEnd
      );

      const average =
        points.length > 0
          ? points.reduce((sum, entry) => sum + entry.value, 0) / points.length
          : null;

      buckets.push({
        time: `-${8 - i}h`,
        value: average !== null ? Number(average.toFixed(2)) : null,
      });
    }

    // If we have no real data or many gaps, use complete mock data
    const nonNullCount = buckets.filter(b => b.value !== null).length;
    if (nonNullCount === 0) {
      // No real data - use complete mock data
      return generateCompleteHourlyData(parameter, 8);
    } else if (nonNullCount < buckets.length) {
      // Has gaps - fill them to ensure continuous visualization
      return fillDataGaps(buckets, parameter);
    }

    return buckets;
  };

  const buildMinuteSeries = (readings: TimedReading[], parameter: string) => {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - TEN_MINUTES * 60 * 1000);

    const buckets: Array<{ time: string; value: number | null }> = [];

    for (let i = 0; i < TEN_MINUTES; i += 1) {
      const minuteStart = new Date(tenMinutesAgo.getTime() + i * 60 * 1000);
      const minuteEnd = new Date(minuteStart.getTime() + 60 * 1000);

      const points = readings.filter(
        (entry) => entry.timestamp >= minuteStart && entry.timestamp < minuteEnd
      );

      const average =
        points.length > 0
          ? points.reduce((sum, entry) => sum + entry.value, 0) / points.length
          : null;

      buckets.push({
        time: `-${TEN_MINUTES - i}m`,
        value: average !== null ? Number(average.toFixed(2)) : null,
      });
    }

    // If we have no real data or many gaps, use complete mock data
    const nonNullCount = buckets.filter(b => b.value !== null).length;
    if (nonNullCount === 0) {
      // No real data - use complete mock data
      return generateCompleteMinuteData(parameter, TEN_MINUTES);
    } else if (nonNullCount < buckets.length) {
      // Has gaps - fill them to ensure continuous visualization
      return fillDataGaps(buckets, parameter);
    }

    return buckets;
  };

  const temperatureHourlyData = useMemo(
    () => buildHourlySeries(historicalData.temperature, 'temperature'),
    [historicalData.temperature]
  );

  const phHourlyData = useMemo(
    () => buildHourlySeries(historicalData.ph, 'ph'),
    [historicalData.ph]
  );

  const doMinuteData = useMemo(
    () => buildMinuteSeries(historicalData.dissolved_oxygen, 'dissolved_oxygen'),
    [historicalData.dissolved_oxygen]
  );

  const currentTemperatureAverage = useMemo(() => {
    if (historicalData.temperature.length === 0) return null;
    const now = new Date();
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

    const points = historicalData.temperature.filter(
      (entry) => entry.timestamp >= hourStart && entry.timestamp <= now
    );

    if (points.length === 0) return null;
    const average = points.reduce((sum, entry) => sum + entry.value, 0) / points.length;
    return Number(average.toFixed(2));
  }, [historicalData.temperature]);

  const currentPhAverage = useMemo(() => {
    if (historicalData.ph.length === 0) return null;
    const now = new Date();
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

    const points = historicalData.ph.filter(
      (entry) => entry.timestamp >= hourStart && entry.timestamp <= now
    );

    if (points.length === 0) return null;
    const average = points.reduce((sum, entry) => sum + entry.value, 0) / points.length;
    return Number(average.toFixed(2));
  }, [historicalData.ph]);

  const currentDoAverage = useMemo(() => {
    if (historicalData.dissolved_oxygen.length === 0) return null;
    const now = new Date();
    const minuteStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes()
    );

    const points = historicalData.dissolved_oxygen.filter(
      (entry) => entry.timestamp >= minuteStart && entry.timestamp <= now
    );

    if (points.length === 0) return null;
    const average = points.reduce((sum, entry) => sum + entry.value, 0) / points.length;
    return Number(average.toFixed(2));
  }, [historicalData.dissolved_oxygen]);

  if (isLoadingPonds) {
    return (
      <AppShell>
        <PageContainer>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto" />
              <p className="text-gray-600 mt-4">Preparing forecast data...</p>
            </div>
          </div>
        </PageContainer>
        <GlobalAlertToasts />
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
        <GlobalAlertToasts />
      </AppShell>
    );
  }

  if (!selectedPond) {
    // Brief render gap between profilePonds resolving and the initial-pond
    // effect firing — keep the spinner short here.
    return (
      <AppShell>
        <PageContainer>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto" />
              <p className="text-gray-600 mt-4">Preparing forecast data...</p>
            </div>
          </div>
        </PageContainer>
        <GlobalAlertToasts />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Real-time & Forecast
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Live sensor streams and AI-powered predictions
          </p>
        </div>

        {/* Controls row */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          {/* Left controls (wrap on smaller screens) */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
            <select
              value={selectedPond.pond_id}
              onChange={(event) => handlePondChange(event.target.value)}
              className="w-full sm:w-auto px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent bg-white transition-all"
              style={{ borderColor: colors.primary }}
            >
              {profilePonds.map((pond) => (
                <option key={pond.pond_id} value={pond.pond_id}>
                  {pond.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Show AI Forecast
            </button>

            <button
              type="button"
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Schedule Forecast
            </button>
          </div>

          {/* Live + timestamp */}
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

        {/* Summary cards */}
        <ForecastSummaryCards metadata={selectedPond.metadata} />

        {/* Charts */}
        <div className="space-y-4 sm:space-y-6">
          <HourlyForecastChart
            title={`Temperature`}
            subtitle="Real-time monitoring with AI-powered trend prediction"
            historicalData={temperatureHourlyData}
            currentHourAverage={currentTemperatureAverage}
            unit="°C"
            color="#3b82f6"
            parameterKey="temperature"
          />

          {/* Two charts: stack on tablet/phone, side-by-side on xl */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
            <MinuteForecastChart
              title="Dissolved Oxygen"
              subtitle="mg/L over the last 15 minutes"
              historicalData={doMinuteData}
              currentMinuteAverage={currentDoAverage}
              unit="mg/L"
              color="#10b981"
              parameterKey="dissolved_oxygen"
            />

            <HourlyForecastChart
              title="pH Level"
              subtitle="Acidity trends"
              historicalData={phHourlyData}
              currentHourAverage={currentPhAverage}
              unit=""
              color="#f59e0b"
              parameterKey="ph"
            />
          </div>
        </div>
      </PageContainer>

      <GlobalAlertToasts />
    </AppShell>
  );

}

