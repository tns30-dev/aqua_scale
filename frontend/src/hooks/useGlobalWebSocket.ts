import { useEffect, useRef } from 'react';
import { usePondStore } from '../stores/pondStore';
import { apiService } from '../services/api.service';
import { getCurrentProjectId } from '../utils/auth';
import { useSession } from '../context/SessionContext';
import { useProfile } from '../context/ProfileContext';
import { websocketService } from '../services/websocket.service';
import type { SensorReading, Pond } from '../types';

/**
 * Initialize global WebSocket connections after login
 * Completely rewritten to prevent duplicate connections
 */
export function useGlobalWebSocket() {
  const { setPonds, setProjects, updateReading } = usePondStore();
  const { user, projects } = useSession();
  const { currentProfile } = useProfile();
  const connectionsInitialized = useRef(false);
  const initializedProjectId = useRef<string | null>(null);
  const pondsRef = useRef<Pond[]>([]);

  useEffect(() => {
    if (!user) {
      websocketService.disconnectAll();
      connectionsInitialized.current = false;
      initializedProjectId.current = null;
      pondsRef.current = [];
      return;
    }

    const projectId = getCurrentProjectId();
    if (!projectId) {
      websocketService.disconnectAll();
      connectionsInitialized.current = false;
      initializedProjectId.current = null;
      pondsRef.current = [];
      usePondStore.setState({
        liveReadings: new Map(),
        lastUpdated: null,
        activeAlerts: [],
      });
      return;
    }

    if (connectionsInitialized.current && initializedProjectId.current === projectId) {
      return;
    }

    const initWebSocket = async () => {
      try {
        // Sync the user's accessible projects into the pond store from session.
        setProjects(projects);
        usePondStore.setState({
          liveReadings: new Map(),
          lastUpdated: null,
          activeAlerts: [],
        });

        // Fetch all ponds for the selected project.
        const response = await apiService.getPonds(projectId);
        setPonds(response.ponds);
        pondsRef.current = response.ponds;

        const pondIds = new Set(response.ponds.map((pond) => pond.pond_id));

        // Restore only cached readings that belong to this project. Keeping the
        // old project's readings makes project switches show stale timestamps.
        const cached = localStorage.getItem('lastReadingsByPond');
        if (cached) {
          try {
            const parsed: Record<string, SensorReading> = JSON.parse(cached);
            const map = new Map<string, SensorReading>(
              Object.entries(parsed).filter(([pondId]) => pondIds.has(pondId)),
            );
            usePondStore.setState({ liveReadings: map });

            if (map.size > 0) {
              const latestTime = Math.max(
                ...Array.from(map.values()).map((reading) =>
                  new Date(reading.timestamp).getTime(),
                ),
              );
              usePondStore.setState({
                lastUpdated: Number.isFinite(latestTime) ? new Date(latestTime) : null,
              });
            } else {
              usePondStore.setState({ lastUpdated: null, activeAlerts: [] });
            }
          } catch {
            // ignore parse errors
          }
        } else {
          usePondStore.setState({
            liveReadings: new Map(),
            lastUpdated: null,
            activeAlerts: [],
          });
        }

        try {
          const latest = await apiService.getLatestPondReadings(
            projectId,
            response.ponds.map((pond) => pond.pond_id),
          );
          latest.readings.forEach(({ pond_id, reading }) => {
            updateReading(pond_id, reading);
          });
        } catch (error) {
          console.error('Failed to bootstrap latest pond readings:', error);
        }

        // Mark as initialized BEFORE creating connections
        connectionsInitialized.current = true;
        initializedProjectId.current = projectId;

        // Connect to each pond
        response.ponds.forEach((pond: Pond) => {
          const connectionId = `pond_${pond.pond_id}`;
          
          // Skip if already connected
          if (websocketService.isConnected(connectionId)) {
            return;
          }

          websocketService.connectToPond(
            pond.pond_id,
            (reading) => {
              updateReading(pond.pond_id, reading);
            },
            (error) => {
              console.error(`WebSocket error for ${pond.name}:`, error);
            }
          );
        });

      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
      }
    };

    initWebSocket();

    // Cleanup on unmount
    return () => {
      websocketService.disconnectAll();
      connectionsInitialized.current = false;
      initializedProjectId.current = null;
      pondsRef.current = [];
    };
    // currentProfile is the reactive signal for project/profile switches; the
    // project id itself lives in localStorage for back-compat with older pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentProfile]);
}
