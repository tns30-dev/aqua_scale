import { useEffect, useRef } from 'react';
import { usePondStore } from '../stores/pondStore';
import { apiService } from '../services/api.service';
import { getCurrentProjectId } from '../utils/auth';
import { useSession } from '../context/SessionContext';
import { websocketService } from '../services/websocket.service';
import type { AlertInfo, SensorReading, Pond } from '../types';

/**
 * Initialize global WebSocket connections after login
 * Completely rewritten to prevent duplicate connections
 */
export function useGlobalWebSocket() {
  const { setPonds, setProjects, updateReading, addAlert, resolveAlert } = usePondStore();
  const { user, projects } = useSession();
  const connectionsInitialized = useRef(false);
  const pondsRef = useRef<Pond[]>([]);
  const projectIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!user) {
      websocketService.disconnectAll();
      connectionsInitialized.current = false;
      pondsRef.current = [];
      projectIdsRef.current = [];
      return;
    }

    if (connectionsInitialized.current) {
      return;
    }

    const initWebSocket = async () => {
      try {
        // Sync the user's accessible projects into the pond store from session.
        setProjects(projects);
        projectIdsRef.current = projects.map((project) => project.projectId);

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

        // Connect project-level alert frames. The gateway filters delivery by
        // the user's Redis authz snapshot; frontend filtering here routes the
        // resulting frames into the existing pond alert/toast state.
        projectIdsRef.current.forEach((projectId) => {
          if (websocketService.isConnected(`project_${projectId}`)) {
            return;
          }

          websocketService.connectToProject(
            projectId,
            (frame) => {
              handleRealtimeAlertFrame(frame as unknown as Record<string, unknown>);
            },
            (error) => {
              console.error(`WebSocket project error for ${projectId}:`, error);
            },
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
      pondsRef.current = [];
      projectIdsRef.current = [];
    };
    // User is the gate; once it transitions from null to a User after session
    // load, the ref guard keeps this from opening duplicate gateway sockets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function handleRealtimeAlertFrame(frame: Record<string, unknown>) {
    const frameType = asString(frame.type);
    const alertPayload = asRecord(frame.alert);
    const pondId = asString(frame.pond_id) ?? asString(alertPayload?.pond_id);
    const parameter = asString(frame.parameter) ?? asString(alertPayload?.parameter);

    if (!pondId || !parameter) return;

    if (frameType === 'alert_resolved') {
      const active = usePondStore
        .getState()
        .activeAlerts.find(
          (alert) =>
            alert.pondId === pondId &&
            alert.parameter === parameter &&
            alert.status === 'active',
        );
      if (active) {
        resolveAlert(active.id);
      }
      return;
    }

    if (frameType !== 'alert' || !alertPayload) return;

    const severity = asString(alertPayload.severity);
    if (severity !== 'critical' && severity !== 'warning') return;

    const pondName =
      pondsRef.current.find((pond) => pond.pond_id === pondId)?.name ??
      'Unknown Pond';

    const alert: AlertInfo = {
      parameter,
      severity,
      currentValue: asNumber(alertPayload.current_value) ?? 0,
      threshold: asNumber(alertPayload.threshold) ?? 0,
      message: asString(alertPayload.message) ?? `${parameter} threshold alert`,
    };

    addAlert(pondId, pondName, alert);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
