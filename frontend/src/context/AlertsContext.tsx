import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Alert } from "../types";
import { apiService } from "../services/api.service";
import { websocketService } from "../services/websocket.service";
import { getCurrentProjectId } from "../utils/auth";
import { useSession } from "./SessionContext";

interface AlertsContextValue {
  alerts: Alert[];
  resolvingIds: Set<string>;
  resolve: (alertId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AlertsContext = createContext<AlertsContextValue>({
  alerts: [],
  resolvingIds: new Set(),
  resolve: async () => {},
  refresh: async () => {},
});

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const projectId = getCurrentProjectId();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!projectId) {
      setAlerts([]);
      return;
    }
    try {
      const { alerts } = await apiService.getAlerts(projectId);
      setAlerts(alerts);
    } catch {
      // Keep the last good list through transient realtime/API failures.
    }
  }, [projectId]);

  useEffect(() => {
    if (!user || !projectId) {
      setAlerts([]);
      setResolvingIds(new Set());
      return;
    }

    void refresh();
    const disconnect = websocketService.connectToProject(projectId, (frame) => {
      if (frame.type === "alert" || frame.type === "alert_resolved") {
        void refresh();
      }
    });
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      disconnect();
      window.removeEventListener("focus", onFocus);
    };
  }, [user, projectId, refresh]);

  const resolve = useCallback(
    async (alertId: string) => {
      setResolvingIds((prev) => new Set(prev).add(alertId));
      try {
        const userId = localStorage.getItem("userId") || "";
        await apiService.acknowledgeAlert(alertId, userId);
        window.setTimeout(() => {
          void refresh();
          setResolvingIds((prev) => {
            const next = new Set(prev);
            next.delete(alertId);
            return next;
          });
        }, 800);
      } catch {
        setResolvingIds((prev) => {
          const next = new Set(prev);
          next.delete(alertId);
          return next;
        });
      }
    },
    [refresh],
  );

  return (
    <AlertsContext.Provider value={{ alerts, resolvingIds, resolve, refresh }}>
      {children}
    </AlertsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAlerts() {
  return useContext(AlertsContext);
}
