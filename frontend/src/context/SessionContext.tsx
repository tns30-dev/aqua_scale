import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiService } from "../services/api.service";
import { PLATFORM_ADMIN_ROLE } from "../utils/auth";
import type { MeResponse, Project, User } from "../types";

/**
 * Session state — identity, permissions, and accessible projects for the
 * currently authenticated user. Populated by GET /api/auth/me on app boot
 * (and after successful login), cleared on logout.
 * Lives in-memory only. localStorage holds none of this anymore — refreshing
 * the tab triggers a single /me call to rehydrate from the backend, so a
 * permission change on the server is reflected on the very next reload.
 */
interface SessionContextValue {
  /** Identity + role + featureActionAssigned permissions. `null` when unauthenticated or before first refresh(). */
  user: User | null;
  /** Flat list of projects this user has access to. */
  projects: Project[];
  /** True while a `refresh()` is in flight. */
  loading: boolean;
  /** Fetch /api/auth/me and populate user + projects. Swallows 401 by clearing state. */
  refresh: () => Promise<void>;
  /** Populate session directly from a known-good payload (e.g. the login response).
   * Skips the extra /api/auth/me round trip when the data is already in hand. */
  setSession: (payload: MeResponse) => void;
  /** Drop in-memory session state. Call on logout. */
  clear: () => void;
  /** Convenience: `!loading && !!user`. Use this for route guards. */
  isAuthenticated: boolean;
  /** Convenience: `user?.role === 'platform_admin'`. The ONLY role checked
   * anywhere in the app — every other access decision goes through
   * `hasFeatureAccess` / `hasActionControl`, not role comparisons. */
  isPlatformAdmin: boolean;
  /** Part 3: true if any entry has feature_access === code OR feature_access === "*". */
  hasFeatureAccess: (featureCode: string) => boolean;
  /** Part 3: true if code is in any entry's action_controls, OR "*" is in any entry's
   *  action_controls, OR any entry has feature_access === "*". */
  hasActionControl: (actionCode: string) => boolean;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

export function SessionProvider({ children }: { children: ReactNode }) {
  // Single source of truth: the whole MeResponse envelope. `user` and
  // `projects` derive from it in the memo below — keeping them as separate
  // state slices invited drift (one updated, the other stale) without buying
  // anything, since every writer set both together.
  const [session, setSessionState] = useState<MeResponse | null>(null);
  // Initial loading = true so route guards block on the very first render and
  // wait for the boot probe to resolve. Without this, ProtectedRoute would
  // see user=null on the first paint and redirect to /login BEFORE the boot
  // useEffect even runs — the "refresh kicks you to login" race.
  const [loading, setLoading] = useState(true);

  // Explicit refresh — used by anyone who wants to re-verify the session
  // (e.g. after a user-modification we want to reflect immediately). Clears
  // on 401 because, at this point, the caller is *asserting* "I want fresh
  // server state" and a 401 here is a real expiry signal.
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSessionState(await apiService.getMe());
    } catch {
      setSessionState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const setSession = useCallback((payload: MeResponse) => {
    setSessionState(payload);
    // Unblock route guards even if the boot probe is still in flight.
    setLoading(false);
  }, []);

  const clear = useCallback(() => {
    setSessionState(null);
    setLoading(false);
  }, []);

  // Boot: first get the readable CSRF cookie, then probe /api/auth/me. If the
  // access cookie is expired but the refresh cookie is still valid, api.service
  // refreshes and retries once.
  useEffect(() => {
    (async () => {
      try {
        await apiService.bootstrapCsrf();
        setSessionState(await apiService.getMe());
      } catch {
        // Leave session as-is.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<SessionContextValue>(() => {
    const user: User | null = session?.user ?? null;
    const projects: Project[] = session?.projects ?? [];
    // Safe view of the permission array — empty list when missing/malformed.
    // Mirrors RBACService._iter_entries on the BE.
    const entries = Array.isArray(user?.featureActionAssigned)
      ? user!.featureActionAssigned.filter(
          (e) => e && typeof e === "object" && Array.isArray(e.action_controls),
        )
      : [];
    return {
      user,
      projects,
      loading,
      refresh,
      setSession,
      clear,
      isAuthenticated: !loading && !!user,
      isPlatformAdmin: user?.role === PLATFORM_ADMIN_ROLE,
      hasFeatureAccess: (code: string) =>
        entries.some(
          (e) => e.feature_access === "*" || e.feature_access === code,
        ),
      hasActionControl: (code: string) =>
        entries.some(
          (e) =>
            e.feature_access === "*" ||
            e.action_controls.includes("*") ||
            e.action_controls.includes(code),
        ),
    };
  }, [session, loading, refresh, setSession, clear]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}
