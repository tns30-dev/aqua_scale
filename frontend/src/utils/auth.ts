/**
 * Auth utility functions — localStorage read/write for the slice of state that
 * still legitimately lives in localStorage. Separated from api.service.ts which
 * only handles HTTP calls.
 *
 * localStorage holds only:
 * - `currentProjectId`     — the project selected in the UI
 * - `currentProfileType`   — derived from current project
 *
 * Java Identity currently returns bearer tokens in the response body. Until the
 * backend moves refresh tokens to HttpOnly cookies, the SPA keeps them in
 * sessionStorage so a tab refresh can recover the session without localStorage.
 * Identity + projects + permissions still live in `SessionContext`.
 * Auth state is not synchronously readable — consumers should use
 * `useSession()` and gate on `loading` + `!!user`.
 */

// localStorage key constants — single source of truth
const KEY_CURRENT_PROJECT_ID = 'currentProjectId';
const KEY_CURRENT_PROFILE_TYPE = 'currentProfileType';
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
  return sessionStorage.getItem(KEY_ACCESS_TOKEN);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(KEY_REFRESH_TOKEN);
}

export function setAuthTokens(accessToken: string, refreshToken: string): void {
  sessionStorage.setItem(KEY_ACCESS_TOKEN, accessToken);
  sessionStorage.setItem(KEY_REFRESH_TOKEN, refreshToken);
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
