/**
 * Auth utility functions — localStorage read/write for the slice of state that
 * still legitimately lives in localStorage. Separated from api.service.ts which
 * only handles HTTP calls.
 *
 * localStorage holds only:
 * - `currentProjectId`     — the project selected in the UI
 * - `currentProfileType`   — derived from current project
 *
 * Browser authentication is carried by HttpOnly cookies. The SPA never stores
 * access or refresh tokens in web storage; a tab refresh rehydrates through
 * `/api/auth/me` and cookie refresh handled by api.service.ts.
 * Auth state is not synchronously readable — consumers should use
 * `useSession()` and gate on `loading` + `!!user`.
 */

// localStorage key constants — single source of truth
const KEY_CURRENT_PROJECT_ID = 'currentProjectId';
const KEY_CURRENT_PROFILE_TYPE = 'currentProfileType';
// Legacy bearer-storage keys kept only so logout can remove old first-round data.
const KEY_ACCESS_TOKEN = 'aquashieldAccessToken';
const KEY_REFRESH_TOKEN = 'aquashieldRefreshToken';

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

export function getAccessToken(): string | null {
  return null;
}

export function getRefreshToken(): string | null {
  return null;
}

export function setAuthTokens(_accessToken: string, _refreshToken: string): void {
  clearAuthTokens();
}

export function clearAuthTokens(): void {
  sessionStorage.removeItem(KEY_ACCESS_TOKEN);
  sessionStorage.removeItem(KEY_REFRESH_TOKEN);
}

// ---------------------------------------------------------------------------
// Logout — clear the UI-state keys we own. Server-side cookie clearing is
// handled by POST /api/auth/logout (see api.service.ts).
// ---------------------------------------------------------------------------

export function clearAuth(): void {
  localStorage.removeItem(KEY_CURRENT_PROJECT_ID);
  localStorage.removeItem(KEY_CURRENT_PROFILE_TYPE);
  clearAuthTokens();
}
