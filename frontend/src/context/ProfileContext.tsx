import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ProfileType, ProfileConfig } from '../types/profile';
import { apiService } from '../services/api.service';
import { useSession } from './SessionContext';

/**
 * Profile Context Interface
 */
interface ProfileContextValue {
  /** Currently active profile code (free-text string post Part-2 / Phase 1). */
  currentProfile: ProfileType;

  /** Configuration for the current profile. Always defined — STUB_PROFILE during loading. */
  profileConfig: ProfileConfig;

  /** Switch to a different profile */
  switchProfile: (profileType: ProfileType) => void;

  /** Whether the profile is currently being switched */
  isSwitching: boolean;

  /** Profile codes the logged-in user has access to (session.projects.profileType ∩ catalogue). */
  userProfiles: ProfileType[];
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

/** Local-storage key for persisting profile selection across refreshes. */
const PROFILE_STORAGE_KEY = 'aquashield_selected_profile';

/**
 * Stub profile used until `/api/profile-types/` resolves. Consumers always
 * receive a `ProfileConfig` (never undefined) — the stub keeps theme writes
 * + render paths safe during the fetch window. Grey placeholder matches the
 * BE Phase 1 default; one render flash is acceptable per D6.
 */
const STUB_PROFILE: ProfileConfig = {
  profileTypeId: '',
  code: '',
  name: '',
  description: null,
  stageConfig: null,
  keyParameterIndicators: [],
  keyGrowthIndicators: [],
  theme: {
    primary: '#888888',
    gradient: { from: '#888888', to: '#cccccc' },
  },
};

interface ProfileProviderProps {
  children: React.ReactNode;
  /** Optional default profile code. Used only on first paint before any data lands. */
  defaultProfile?: ProfileType;
}

/**
 * Profile Provider Component
 *
 * Holds the API-fetched profile catalogue + the user's current selection.
 * Fetches `/api/profile-types/` once when the session becomes authenticated;
 * fail-soft to an empty catalogue on error (stub stays).
 */
export function ProfileProvider({ children, defaultProfile }: ProfileProviderProps): React.ReactElement {
  const { projects, isAuthenticated } = useSession();

  // Profile catalogue from the API. `null` = not yet loaded; `[]` = loaded empty
  // OR failed to load (fail-soft).
  const [profiles, setProfiles] = useState<ProfileConfig[] | null>(null);

  // Initial current-profile choice. We don't validate against the catalogue
  // here because it hasn't loaded yet — the realignment effect below picks
  // the right code once data arrives.
  const [currentProfile, setCurrentProfile] = useState<ProfileType>(() => {
    return localStorage.getItem(PROFILE_STORAGE_KEY) ?? defaultProfile ?? '';
  });
  const [isSwitching, setIsSwitching] = useState(false);

  // Fetch the catalogue once the session is authenticated. Fail-soft: on
  // error, mark profiles as `[]` so we stop retrying and the stub stays.
  useEffect(() => {
    if (isAuthenticated && profiles === null) {
      apiService
        .getProfileTypes()
        .then(setProfiles)
        .catch(() => setProfiles([]));
    }
  }, [isAuthenticated, profiles]);

  // Reset catalogue cache on logout so the next login refetches. Without
  // this, a profile added in Django admin mid-session stays invisible to
  // the FE even after a logout+login round-trip — the `profiles===null`
  // guard above would never re-true otherwise.
  useEffect(() => {
    if (!isAuthenticated) {
      setProfiles(null);
    }
  }, [isAuthenticated]);

  // Codes the user has projects for AND that exist in the catalogue.
  const userProfiles = useMemo<ProfileType[]>(() => {
    if (!profiles) return [];
    const sessionCodes = new Set(projects.map((p) => p.profileType));
    return profiles.filter((p) => sessionCodes.has(p.code)).map((p) => p.code);
  }, [profiles, projects]);

  // Realign currentProfile against the user's actual assignment, not just
  // catalogue membership. A stale localStorage value like "shrimp" would
  // otherwise survive even for a user whose only project is on a different
  // profile — they'd see the wrong theme indefinitely. This restores the
  // pre-Part-2 invariant that Phase 3's rewrite accidentally loosened.
  useEffect(() => {
    if (!profiles || profiles.length === 0) return;

    // Normal case: user has assigned profiles → currentProfile must be one of them.
    if (userProfiles.length > 0) {
      if (userProfiles.includes(currentProfile)) return;
      setCurrentProfile(userProfiles[0]);
      return;
    }

    // Edge case (superuser / unassigned account): no userProfiles → keep
    // currentProfile if it's any catalogue code, else use the first.
    const validCodes = new Set(profiles.map((p) => p.code));
    if (validCodes.has(currentProfile)) return;
    setCurrentProfile(profiles[0].code);
  }, [profiles, userProfiles, currentProfile]);

  // Resolve profileConfig: find by current code → first catalogue entry → stub.
  const profileConfig = useMemo<ProfileConfig>(() => {
    if (!profiles || profiles.length === 0) return STUB_PROFILE;
    const found = profiles.find((p) => p.code === currentProfile);
    return found ?? profiles[0];
  }, [profiles, currentProfile]);

  // Persist profile selection to localStorage (only when a real code is set).
  useEffect(() => {
    if (currentProfile) {
      localStorage.setItem(PROFILE_STORAGE_KEY, currentProfile);
    }
  }, [currentProfile]);

  // Apply theme CSS variables when profile changes. Only the 3 consumed vars
  // are written; `--profile-secondary` and `--profile-accent` were dropped
  // when Phase 1 trimmed the ProfileTheme shape (no consumers).
  useEffect(() => {
    const { theme } = profileConfig;
    const root = document.documentElement;
    root.style.setProperty('--profile-primary', theme.primary);
    root.style.setProperty('--profile-gradient-from', theme.gradient.from);
    root.style.setProperty('--profile-gradient-to', theme.gradient.to);

    // Optional: Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.primary);
    }
  }, [profileConfig]);

  // Switch profile with brief loading flair (preserves the existing UX).
  const switchProfile = useCallback((profileType: ProfileType) => {
    if (profileType === currentProfile) return;
    setIsSwitching(true);
    setTimeout(() => {
      setCurrentProfile(profileType);
      setIsSwitching(false);
    }, 150);
  }, [currentProfile]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      currentProfile,
      profileConfig,
      switchProfile,
      isSwitching,
      userProfiles,
    }),
    [currentProfile, profileConfig, switchProfile, isSwitching, userProfiles]
  );

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

/**
 * Hook to access profile context
 * @throws Error if used outside ProfileProvider
 */
export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}

/** Hook to get only the current profile code */
export function useCurrentProfile(): ProfileType {
  const { currentProfile } = useProfile();
  return currentProfile;
}

/** Hook to get only the profile configuration */
export function useProfileConfig(): ProfileConfig {
  const { profileConfig } = useProfile();
  return profileConfig;
}

/** Hook to get only the profile theme */
export function useProfileTheme() {
  const { profileConfig } = useProfile();
  return profileConfig.theme;
}
