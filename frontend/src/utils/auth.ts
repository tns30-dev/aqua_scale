/**
 * Auth utility functions — localStorage read/write for the slice of state that
 * still legitimately lives in localStorage. Separated from api.service.ts which
 * only handles HTTP calls.
 *
 * localStorage holds only:
 * - `currentProjectId`     — the project selected in the UI
 * - `currentProfileType`   — derived from current project
 *
 * JWTs live in HttpOnly cookies (no JS access — XSS-safe).
 * Identity + projects + permissions live in `SessionContext` (in-memory),
 * rehydrated on app boot via `GET /api/auth/me`.
 * Auth state is not synchronously readable — consumers should use
 * `useSession()` and gate on `loading` + `!!user`.
 */

// localStorage key constants — single source of truth
const KEY_CURRENT_PROJECT_ID = 'currentProjectId';
const KEY_CURRENT_PROFILE_TYPE = 'currentProfileType';

// Only system-constant role. All other role values are free text (no special meaning).
export const PLATFORM_ADMIN_ROLE = 'platform_admin';

// ---------------------------------------------------------------------------
// UI state — pure presentation, not sensitive
// ---------------------------------------------------------------------------

export function getCurrentProjectId(): string | null {
  return localStorage.getItem(KEY_CURRENT_PROJECT_ID);
}

export function setCurrentProjectId(projectId: string): void {
  localStorage.setItem(KEY_CURRENT_PROJECT_ID, projectId);
}

export function getCurrentProfileType(): string | null {
  return localStorage.getItem(KEY_CURRENT_PROFILE_TYPE);
}

export function setCurrentProfileType(profileType: string): void {
  localStorage.setItem(KEY_CURRENT_PROFILE_TYPE, profileType);
}

// ---------------------------------------------------------------------------
// Logout — clear the UI-state keys we own. Server-side cookie clearing is
// handled by POST /api/auth/logout (see api.service.ts).
// ---------------------------------------------------------------------------

export function clearAuth(): void {
  localStorage.removeItem(KEY_CURRENT_PROJECT_ID);
  localStorage.removeItem(KEY_CURRENT_PROFILE_TYPE);
}
