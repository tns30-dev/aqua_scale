import { create } from 'zustand';
import type { Pond, SensorReading, AlertInfo, Project } from '../types';
import { websocketService } from '../services/websocket.service';

interface ActiveAlert extends AlertInfo {
  id: string;
  pondId: string;
  pondName: string;
  timestamp: Date;
  status: 'active' | 'resolved';
}

interface PondStore {
  // State
  ponds: Pond[];
  projects: Project[]; // Added to support profile filtering
  liveReadings: Map<string, SensorReading>;
  isConnected: boolean;
  lastUpdated: Date | null;
  activeAlerts: ActiveAlert[];

  // Actions
  setPonds: (ponds: Pond[]) => void;
  setProjects: (projects: Project[]) => void;
  updateReading: (pondId: string, reading: SensorReading) => void;
  connectToPonds: (pondIds: string[]) => void;
  disconnectAll: () => void;
  getReadingForPond: (pondId: string) => SensorReading | undefined;
  getProfilePonds: (profileType: string) => Pond[];

  addAlert: (pondId: string, pondName: string, alert: AlertInfo) => void;
  resolveAlert: (alertId: string) => void;
  removeAlert: (alertId: string) => void;
}

export const usePondStore = create<PondStore>((set, get) => ({
  // Initial state
  ponds: [],
  projects: [],
  liveReadings: new Map(),
  isConnected: false,
  lastUpdated: null,
  activeAlerts: [],

  // Set ponds from API
  setPonds: (ponds) => {
    set({ ponds });
  },

  // Set projects from API or localStorage
  setProjects: (projects) => {
    set({ projects });
  },

  // Update reading for a specific pond
  updateReading: (pondId, reading) => {
    const stateBefore = get();
    const previousReading = stateBefore.liveReadings.get(pondId);
    const newReadings = new Map(stateBefore.liveReadings);
    newReadings.set(pondId, reading);

    // Cache to localStorage for persistence across refresh
    const obj = Object.fromEntries(newReadings.entries());
    localStorage.setItem('lastReadingsByPond', JSON.stringify(obj));

    // Only update lastUpdated if this reading is newer than the current lastUpdated
    const readingTime = new Date(reading.timestamp);
    const currentLastUpdated = stateBefore.lastUpdated;
    const shouldUpdateTimestamp = !currentLastUpdated || readingTime > currentLastUpdated;

    set({
      liveReadings: newReadings,
      lastUpdated: shouldUpdateTimestamp ? readingTime : currentLastUpdated,
    });

    const pond = stateBefore.ponds.find((p) => p.pond_id === pondId);
    const pondName = pond?.name ?? 'Unknown Pond';

    // Handle new alerts
    if (reading.alerts && reading.alerts.length > 0) {
      reading.alerts.forEach((alert) => {
        const existedPreviously = previousReading?.alerts?.some(
          (prev) => prev.parameter === alert.parameter && prev.severity === alert.severity
        );
        const alreadyActive = get().activeAlerts.some(
          (existing) =>
            existing.pondId === pondId &&
            existing.parameter === alert.parameter &&
            existing.status === 'active'
        );

        if (!existedPreviously && !alreadyActive) {
          get().addAlert(pondId, pondName, alert);
        }
      });
    }

    // Handle resolved alerts
    if (previousReading?.alerts) {
      previousReading.alerts.forEach((prevAlert) => {
        const stillActive = reading.alerts?.some(
          (curr) => curr.parameter === prevAlert.parameter && curr.severity === prevAlert.severity
        );

        if (!stillActive) {
          const matchingAlert = get().activeAlerts.find(
            (active) =>
              active.pondId === pondId &&
              active.parameter === prevAlert.parameter &&
              active.status === 'active'
          );
          if (matchingAlert) {
            get().resolveAlert(matchingAlert.id);
          }
        }
      });
    }
  },

  // Connect to WebSocket for all ponds
  connectToPonds: (pondIds) => {
    // Connect to each pond
    pondIds.forEach((pondId) => {
      websocketService.connectToPond(
        pondId,
        (reading) => {
          get().updateReading(pondId, reading);
        },
        (error) => {
          console.error(`❌ Global WebSocket error for pond ${pondId}:`, error);
        }
      );
    });

    set({ isConnected: true });
  },

  // Disconnect all WebSockets
  disconnectAll: () => {
    websocketService.disconnectAll();
    set({
      isConnected: false,
      liveReadings: new Map(),
      lastUpdated: null,
      activeAlerts: [],
    });
  },

  // Get reading for specific pond
  getReadingForPond: (pondId) => {
    return get().liveReadings.get(pondId);
  },

  // Get ponds for a specific profile (filters by project profileType).
  // Empty result = empty result — no "return all" fallback. Previously the
  // fallback leaked ponds from sibling projects when the current profile
  // had none of its own (e.g. a brand-new profile with zero linked ponds).
  getProfilePonds: (profileType) => {
    const targetProfile = profileType?.toLowerCase();
    return get().ponds.filter(
      (pond) => pond.profile_type?.toLowerCase?.() === targetProfile,
    );
  },

  // Alert management
  addAlert: (pondId, pondName, alert) => {
    set((state) => {
      const exists = state.activeAlerts.some(
        (active) =>
          active.pondId === pondId &&
          active.parameter === alert.parameter &&
          active.status === 'active'
      );

      if (exists) {
        return {};
      }

      const newAlert: ActiveAlert = {
        ...alert,
        id: `${pondId}-${alert.parameter}-${Date.now()}`,
        pondId,
        pondName,
        timestamp: new Date(),
        status: 'active',
      };

      return {
        activeAlerts: [...state.activeAlerts, newAlert],
      };
    });
  },

  resolveAlert: (alertId) => {
    set((state) => ({
      activeAlerts: state.activeAlerts.map((alert) =>
        alert.id === alertId ? { ...alert, status: 'resolved' } : alert
      ),
    }));

    setTimeout(() => {
      get().removeAlert(alertId);
    }, 3000);
  },

  removeAlert: (alertId) => {
    set((state) => ({
      activeAlerts: state.activeAlerts.filter((alert) => alert.id !== alertId),
    }));
  },
}));

