import { useEffect, useRef } from 'react';
import { usePondStore } from '../stores/pondStore';
import { apiService } from '../services/api.service';
import { getCurrentProjectId } from '../utils/auth';
import { useSession } from '../context/SessionContext';
import { websocketService } from '../services/websocket.service';
import type { SensorReading, Pond } from '../types';

/**
 * Initialize global WebSocket connections after login
 * Completely rewritten to prevent duplicate connections
 */
export function useGlobalWebSocket() {
  const { setPonds, setProjects, updateReading } = usePondStore();
  const { user, projects } = useSession();
  const connectionsInitialized = useRef(false);
  const pondsRef = useRef<Pond[]>([]);

  useEffect(() => {
    // CRITICAL: Only run once, even in StrictMode
    if (connectionsInitialized.current) {
      return;
    }

    const initWebSocket = async () => {
      if (!user) {
        return;
      }

      try {
        // Sync the user's accessible projects into the pond store from session.
        setProjects(projects);

        // Restore cached readings from localStorage
        const cached = localStorage.getItem('lastReadingsByPond');
        if (cached) {
          try {
            const parsed: Record<string, SensorReading> = JSON.parse(cached);
            const map = new Map<string, SensorReading>(Object.entries(parsed));
            usePondStore.setState({ liveReadings: map });
            
            if (map.size > 0) {
              const timestamps = Array.from(map.values()).map(r => new Date(r.timestamp));
              const latest = new Date(Math.max(...timestamps.map(d => d.getTime())));
              usePondStore.setState({ lastUpdated: latest });
            }
          } catch {
            // ignore parse errors
          }
        }

        // Fetch ALL ponds
        const projectId = getCurrentProjectId() || 'dummy';
        const response = await apiService.getPonds(projectId);
        setPonds(response.ponds);
        pondsRef.current = response.ponds;

        // Mark as initialized BEFORE creating connections
        connectionsInitialized.current = true;

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
      pondsRef.current.forEach((pond) => {
        websocketService.disconnectFromPond(pond.pond_id);
      });
      // DO NOT reset connectionsInitialized - prevents re-initialization
    };
    // user is the gate — once it transitions from null → User after the
    // session loads, we re-run this effect and the ref-guard lets the body
    // execute exactly once. We intentionally skip `projects` from deps so
    // mid-session project edits don't tear down all WS connections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
}
