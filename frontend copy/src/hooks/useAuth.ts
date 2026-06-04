import { useState } from 'react';
import { apiService } from '../services/api.service';
import { useSession } from '../context/SessionContext';
import type { LoginCredentials, LoginResponse } from '../types';

/**
 * Thin wrapper around login/logout HTTP calls + SessionContext hydration.
 * Authentication state (whether a user is currently logged in) lives in
 * `useSession()` — read `user`, `loading`, `isAuthenticated` from there.
 */
export function useAuth() {
  const { setSession, clear: clearSession, isAuthenticated } = useSession();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (credentials: LoginCredentials): Promise<LoginResponse | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiService.login(credentials);
      // Hydrate SessionContext from the login response — same data shape as
      // /api/auth/me, so no extra round trip needed.
      setSession(response);
      return response;
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Login failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await apiService.logout();
      clearSession();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
  };
}
